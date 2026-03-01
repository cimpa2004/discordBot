const { spawn } = require("child_process");
const { PassThrough } = require("stream");
const playdl = require("play-dl");
const { createAudioResource, StreamType } = require("@discordjs/voice");

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";
const logger = require("./logger").createLogger("Stream");

/**
 * How many bytes to buffer from yt-dlp before backpressure kicks in.
 * A large buffer lets yt-dlp download well ahead of playback, absorbing
 * network hiccups without audio gaps.
 * Override with the STREAM_BUFFER_MB environment variable.
 */
const STREAM_BUFFER_BYTES =
  (Number(process.env.STREAM_BUFFER_MB) || 3) * 1024 * 1024;

/**
 * Builds an AudioResource by piping yt-dlp's stdout directly into Discord.
 * yt-dlp handles YouTube bot-detection, format selection and all HTTP concerns.
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
    const results = await playdl.search(track.searchQuery, {
      source: { youtube: "video" },
      limit: 5,
    });

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
 * Spawns yt-dlp and pipes its stdout into an AudioResource.
 * Uses StreamType.Arbitrary so @discordjs/voice transcodes via ffmpeg.
 * @param {string} videoUrl
 * @returns {Promise<import("@discordjs/voice").AudioResource>}
 */
function spawnYtdlpStream(videoUrl, title = videoUrl) {
  return new Promise((resolve, reject) => {
    logger.info(`Spawning yt-dlp for "${title}": ${videoUrl}`);

    const ytdlp = spawn(YTDLP_PATH, [
      "-f",
      "bestaudio",
      "--no-warnings",
      "-o",
      "-", // output raw audio bytes to stdout
      videoUrl,
    ]);

    const passthrough = new PassThrough({ highWaterMark: STREAM_BUFFER_BYTES });

    ytdlp.stdout.pipe(passthrough);

    ytdlp.stderr.on("data", (chunk) => {
      const line = chunk.toString().trim();
      if (line) logger.debug(`yt-dlp: ${line}`);
    });

    ytdlp.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "yt-dlp not found. Install with: winget install yt-dlp.yt-dlp\n" +
              "Or set YTDLP_PATH in your .env.",
          ),
        );
      } else {
        reject(new Error(`yt-dlp process error: ${err.message}`));
      }
    });

    // Reject only on non-zero exit with no data yet; if data already flowed
    // the resource is live and a late exit code is harmless.
    let started = false;
    passthrough.once("data", () => {
      started = true;
    });

    ytdlp.on("close", (code) => {
      if (code !== 0 && !started) {
        reject(
          new Error(`yt-dlp exited with code ${code} before sending any audio`),
        );
      }
    });

    // Resolve as soon as the first bytes arrive so Discord can start playing
    passthrough.once("readable", () => {
      logger.info(
        `yt-dlp stream is live for "${title}": ${videoUrl} (buffer: ${STREAM_BUFFER_BYTES / 1024 / 1024} MB)`,
      );
      resolve(
        createAudioResource(passthrough, { inputType: StreamType.Arbitrary }),
      );
    });
  });
}

module.exports = { getAudioResource, prefetchResource: getAudioResource };
