const spotifyProvider = require("./spotifyProvider");
const youtubeProvider = require("./youtubeProvider");

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
 * Resolves input using the appropriate (or explicitly specified) provider.
 * @param {string} input - URL, URI, or search query
 * @param {string} [forcedProvider] - Override auto-detection with this provider name
 * @returns {Promise<{tracks: object[], type: string, provider: string}>}
 */
async function resolveInput(input, forcedProvider) {
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
