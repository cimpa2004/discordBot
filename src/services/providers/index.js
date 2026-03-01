const spotifyProvider = require("./spotifyProvider");
const youtubeProvider = require("./youtubeProvider");
const { relevanceScore } = require("../../utils/relevanceScore");

/**
 * Registered provider instances.
 * To add a new provider:
 *   1. Create src/services/providers/yourProvider.js extending BaseProvider
 *   2. require() it here and push it into this array
 * @type {import('./BaseProvider')[]}
 */
const providerList = [spotifyProvider, youtubeProvider];

/** @type {Map<string, import('./BaseProvider')>} name → provider */
const providers = new Map(providerList.map((p) => [p.name, p]));

/** Default provider name used for plain-text search queries */
const DEFAULT_PROVIDER = "spotify";

/**
 * Detects which provider to use based on URL / URI patterns.
 * Falls back to DEFAULT_PROVIDER for plain-text queries.
 * @param {string} input
 * @returns {string} Provider name
 */
function detectProvider(input) {
  for (const provider of providerList) {
    if (provider.patterns.some((re) => re.test(input))) {
      return provider.name;
    }
  }
  return DEFAULT_PROVIDER;
}

/**
 * For plain-text queries (no forced provider, no URL match), searches both
 * Spotify and YouTube in parallel and returns the best single-track result.
 *
 * Preference order:
 *   1. YouTube with higher relevance score
 *   2. YouTube Topic / VEVO channel (official audio — no extra search needed)
 *   3. Spotify (cleaner metadata)
 *   4. YouTube non-official (last resort)
 *
 * @param {string} query
 * @returns {Promise<{tracks: object[], type: string, provider: string}>}
 */
async function resolveBestSearch(query) {
  const [spotifyResult, youtubeResult] = await Promise.allSettled([
    spotifyProvider.searchTrack(query),
    youtubeProvider.searchTrack(query),
  ]);

  const spotifyTrack =
    spotifyResult.status === "fulfilled" ? spotifyResult.value : null;
  const youtubeTrack =
    youtubeResult.status === "fulfilled" ? youtubeResult.value : null;

  if (spotifyResult.status === "rejected") {
    console.warn(
      "[providers] Spotify search failed:",
      spotifyResult.reason?.message,
    );
  }
  if (youtubeResult.status === "rejected") {
    console.warn(
      "[providers] YouTube search failed:",
      youtubeResult.reason?.message,
    );
  }

  const spotifyScore = spotifyTrack
    ? relevanceScore(query, spotifyTrack.title)
    : -1;
  const youtubeScore = youtubeTrack
    ? relevanceScore(query, youtubeTrack.title)
    : -1;

  console.log(
    `[providers] Relevance — Spotify: ${spotifyScore.toFixed(2)} ("${spotifyTrack?.title ?? "n/a"}") | YouTube: ${youtubeScore.toFixed(2)} ("${youtubeTrack?.title ?? "n/a"}")`,
  );

  // If YouTube scores meaningfully better, always prefer it
  if (youtubeTrack && youtubeScore > spotifyScore + 0.1) {
    console.log(
      `[providers] Best: YouTube (higher relevance) — ${youtubeTrack.title}`,
    );
    return { tracks: [youtubeTrack], type: "search", provider: "youtube" };
  }

  // Tied or Spotify is close: prefer official YouTube channel (exact stream URL)
  if (youtubeTrack?._isOfficial && youtubeScore >= spotifyScore - 0.1) {
    console.log(
      `[providers] Best: YouTube (official channel) — ${youtubeTrack.title}`,
    );
    return { tracks: [youtubeTrack], type: "search", provider: "youtube" };
  }

  // Spotify wins otherwise (cleaner metadata)
  if (spotifyTrack) {
    console.log(
      `[providers] Best: Spotify — ${spotifyTrack.title} by ${spotifyTrack.artist}`,
    );
    return { tracks: [spotifyTrack], type: "search", provider: "spotify" };
  }

  // Last resort: non-official YouTube result
  if (youtubeTrack) {
    console.log(
      `[providers] Best: YouTube (non-official) — ${youtubeTrack.title}`,
    );
    return { tracks: [youtubeTrack], type: "search", provider: "youtube" };
  }

  return { tracks: [], type: "search", provider: "none" };
}

/**
 * Resolves input using the appropriate (or explicitly specified) provider.
 * For plain-text queries without a forced provider, searches both Spotify and
 * YouTube concurrently and picks the best result.
 * @param {string} input - URL, URI, or search query
 * @param {string} [forcedProvider] - Override auto-detection with this provider name
 * @returns {Promise<{tracks: object[], type: string, provider: string}>}
 */
async function resolveInput(input, forcedProvider) {
  // Plain-text search with no forced provider → dual search
  if (!forcedProvider && detectProvider(input) === DEFAULT_PROVIDER) {
    return resolveBestSearch(input);
  }

  const providerName = forcedProvider ?? detectProvider(input);
  const provider = providers.get(providerName);

  if (!provider) {
    const available = [...providers.keys()].join(", ");
    throw new Error(
      `Provider "${providerName}" is not supported. Available: ${available}`,
    );
  }

  const result = await provider.resolve(input);
  return { ...result, provider: providerName };
}

module.exports = { resolveInput, detectProvider, providers, DEFAULT_PROVIDER };
