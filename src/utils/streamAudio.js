const { execFile, spawn } = require("child_process");
const playdl = require("play-dl");
const { createAudioResource, StreamType } = require("@discordjs/voice");

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";
const logger = require("./logger").createLogger("Stream");

/**
 * Fallback search using yt-dlp when play-dl search fails.
 * @param {string} query
 * @returns {Promise<object[]>}
 */
function searchViaYtdlp(query) {
  return new Promise((resolve, reject) => {
    execFile(
      YTDLP_PATH,
      ["--flat-playlist", "-J", "--no-warnings", `ytsearch5:${query}`],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") {
            reject(new Error("yt-dlp not found. Set YTDLP_PATH in .env"));
          } else {
            reject(new Error(`yt-dlp search error: ${stderr || err.message}`));
          }
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
          resolve(entries.filter((entry) => entry && entry.id));
        } catch {
          reject(new Error("Failed to parse yt-dlp search JSON output"));
        }
      },
    );
  });
}

/**
 * Builds an AudioResource from yt-dlp's media stream.
 * play-dl is only used for the text-search step (metadata, no streaming).
 *
 * @param {object} track - Resolved track from a provider (see BaseProvider)
 * @returns {Promise<import("@discordjs/voice").AudioResource>}
 */
async function getAudioResource(track) {
  let videoUrl = track.youtubeUrl;

  if (!videoUrl) {
    // Resolve a YouTube URL from a text query using play-dl search (metadata only)
    logger.info(`Searching YouTube for: "${track.searchQuery}"`);
    let results = [];
    try {
      results = await playdl.search(track.searchQuery, {
        source: { youtube: "video" },
        limit: 5,
      });
    } catch (err) {
      logger.warn(
        `play-dl search failed in stream resolver, falling back to yt-dlp: ${err.message}`,
      );
      const entries = await searchViaYtdlp(track.searchQuery);
      results = entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        channel: { name: entry.uploader || entry.channel || "Unknown" },
      }));
    }

    if (!results.length) {
      throw new Error(`No YouTube results found for: ${track.searchQuery}`);
    }

    const best =
      results.find(
        (r) =>
          r.channel?.name?.endsWith("- Topic") ||
          r.channel?.name?.toUpperCase().includes("VEVO"),
      ) ?? results[0];

    if (!best.id) {
      throw new Error(
        `Could not get YouTube video ID for: ${track.searchQuery}`,
      );
    }

    videoUrl = `https://www.youtube.com/watch?v=${best.id}`;
    logger.info(`Selected YouTube video: "${best.title}" (${videoUrl})`);
  } else {
    logger.info(
      `Using pre-resolved YouTube URL for "${track.title}": ${videoUrl}`,
    );
  }

  // Validate the URL contains a proper video ID before spawning yt-dlp
  if (
    !/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(videoUrl)
  ) {
    throw new Error(`Invalid YouTube URL: ${videoUrl}`);
  }

  return spawnYtdlpStream(videoUrl, track.title);
}

/**
 * Spawns yt-dlp and passes its media stdout directly to Discord.
 * @param {string} videoUrl
 * @param {string} title
 * @returns {Promise<import("@discordjs/voice").AudioResource>}
 */
function spawnYtdlpStream(videoUrl, title) {
  return new Promise((resolve, reject) => {
    logger.info(`Spawning yt-dlp for "${title}": ${videoUrl}`);
    const ytdlp = spawn(YTDLP_PATH, [
      "-f",
      "bestaudio",
      "--no-playlist",
      "--no-warnings",
      "-o",
      "-",
      videoUrl,
    ]);

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    ytdlp.on("error", (err) => {
      if (err.code === "ENOENT") {
        fail(
          new Error(
            "yt-dlp not found. Install with: winget install yt-dlp.yt-dlp\n" +
              "Or set YTDLP_PATH in your .env.",
          ),
        );
      } else {
        fail(new Error(`yt-dlp process error: ${err.message}`));
      }
    });

    ytdlp.stderr.on("data", (chunk) => {
      const line = chunk.toString().trim();
      if (line) logger.debug(`yt-dlp: ${line}`);
    });

    ytdlp.stdout.once("readable", () => {
      if (settled) return;
      settled = true;
      logger.info(`yt-dlp stream is live for "${title}"`);
      resolve(
        createAudioResource(ytdlp.stdout, {
          inputType: StreamType.Arbitrary,
        }),
      );
    });

    ytdlp.stdout.once("error", (err) => {
      logger.error(`yt-dlp audio stream failed for "${title}":`, err);
      fail(new Error(`yt-dlp audio stream error: ${err.message}`));
    });

    ytdlp.on("close", (code) => {
      if (code !== 0 && !settled) {
        fail(new Error(`yt-dlp exited with code ${code} before sending audio`));
      }
    });
  });
}

module.exports = { getAudioResource, prefetchResource: getAudioResource };
