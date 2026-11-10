const { execFile } = require("child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const playdl = require("play-dl");
const { createAudioResource, StreamType } = require("@discordjs/voice");

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";
const logger = require("./logger").createLogger("Stream");
const resourceStreams = new WeakMap();
const cancelledStreams = new WeakSet();
const DOWNLOAD_RETRIES = 2;
const DOWNLOAD_FORMATS = [
  "251",
  "249",
  "140",
  "139",
  "18",
];

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

  return downloadYtdlpFile(videoUrl, track.title);
}

/**
 * Downloads one complete WebM/Opus track before handing it to Discord.
 * This avoids a live child-process pipe being mistaken for an ended resource.
 * @param {string} videoUrl
 * @param {string} title
 * @returns {Promise<import("@discordjs/voice").AudioResource>}
 */
function downloadYtdlpFile(videoUrl, title) {
  return new Promise((resolve, reject) => {
    function attempt(formatIndex, retryNumber) {
      const format = DOWNLOAD_FORMATS[formatIndex];
      const filePath = path.join(
        os.tmpdir(),
        `discordbot-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`,
      );
      logger.info(
        `Downloading audio for "${title}" with yt-dlp (format ${format}, retry ${retryNumber}/${DOWNLOAD_RETRIES})`,
      );

      execFile(
        YTDLP_PATH,
        [
          "--no-playlist",
          "--no-part",
          "--retries",
          "3",
          "--fragment-retries",
          "3",
          "--retry-sleep",
          "1",
          "--no-warnings",
          "--no-progress",
          "-f",
          format,
          "-o",
          filePath,
          videoUrl,
        ],
        { maxBuffer: 2 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            fs.rm(filePath, { force: true }, () => {});
            if (err.code === "ENOENT") {
              reject(
                new Error(
                  "yt-dlp not found. Install with: winget install yt-dlp.yt-dlp\n" +
                    "Or set YTDLP_PATH in your .env.",
                ),
              );
              return;
            }
            if (retryNumber < DOWNLOAD_RETRIES) {
              setTimeout(() => attempt(formatIndex, retryNumber + 1), 1000);
              return;
            }
            if (formatIndex + 1 < DOWNLOAD_FORMATS.length) {
              setTimeout(() => attempt(formatIndex + 1, 1), 1000);
              return;
            }
            reject(new Error(`yt-dlp error: ${stderr || err.message}`));
            return;
          }

          const audioStream = fs.createReadStream(filePath);
          const cleanup = () => fs.rm(filePath, { force: true }, () => {});
          audioStream.once("close", cleanup);
          audioStream.once("error", (streamError) => {
            if (cancelledStreams.has(audioStream)) return;
            logger.error(
              `Audio file stream failed for "${title}":`,
              streamError,
            );
            cleanup();
          });

          const resource = createAudioResource(audioStream, {
            inputType: StreamType.Arbitrary,
          });
          resourceStreams.set(resource, audioStream);
          logger.info(`Audio file is ready for "${title}"`);
          resolve(resource);
        },
      );
    }

    attempt(0, 1);
  });
}

/**
 * Stops the yt-dlp process associated with an audio resource.
 * A player stop destroys the stdout pipe first, so mark the resource before
 * stopping the process to avoid reporting that intentional close as a failure.
 * @param {import("@discordjs/voice").AudioResource|null} resource
 */
function stopAudioResource(resource) {
  if (!resource) return;
  const audioStream = resourceStreams.get(resource);
  if (!audioStream || audioStream.destroyed) return;
  cancelledStreams.add(audioStream);
  audioStream.destroy();
}

module.exports = {
  getAudioResource,
  prefetchResource: getAudioResource,
  stopAudioResource,
};
