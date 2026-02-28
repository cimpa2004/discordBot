const { execFile } = require("child_process");
const https = require("https");
const http = require("http");
const playdl = require("play-dl");
const { createAudioResource, StreamType } = require("@discordjs/voice");

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";

/**
 * Searches YouTube via play-dl, gets the direct audio URL via yt-dlp --get-url,
 * then fetches it with https — exactly like the soundboard does with S3 URLs.
 * If track.youtubeUrl is already set (e.g. from the YouTube provider), the
 * play-dl search step is skipped and the URL is used directly.
 * ffmpeg is already set up in PATH by ffmpegSetup.js.
 *
 * @param {object} track - Resolved track from a provider (see BaseProvider)
 * @returns {Promise<import("@discordjs/voice").AudioResource>}
 */
async function getAudioResource(track) {
  let videoUrl = track.youtubeUrl;

  if (!videoUrl) {
    // Fall back to searching YouTube via play-dl
    const results = await playdl.search(track.searchQuery, {
      source: { youtube: "video" },
      limit: 1,
    });

    if (!results.length) {
      throw new Error(`No YouTube results found for: ${track.searchQuery}`);
    }

    const videoId = results[0].id;
    if (!videoId) {
      throw new Error(
        `Could not get YouTube video ID for: ${track.searchQuery}`,
      );
    }

    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  }

  // Ask yt-dlp for the direct audio stream URL (no downloading)
  const directUrl = await getDirectUrl(videoUrl);

  // Fetch the URL and pipe into Discord — same pattern as the soundboard
  return new Promise((resolve, reject) => {
    const protocol = directUrl.startsWith("https") ? https : http;
    protocol
      .get(directUrl, (res) => {
        if (res.statusCode >= 400) {
          reject(new Error(`Audio URL returned HTTP ${res.statusCode}`));
          return;
        }
        const resource = createAudioResource(res, {
          inputType: StreamType.Arbitrary,
        });
        resolve(resource);
      })
      .on("error", reject);
  });
}

/**
 * Runs `yt-dlp --get-url -f bestaudio` and returns the direct audio URL.
 * @param {string} videoUrl
 * @returns {Promise<string>}
 */
function getDirectUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    execFile(
      YTDLP_PATH,
      ["-f", "bestaudio", "--get-url", "--no-warnings", videoUrl],
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") {
            reject(
              new Error(
                "yt-dlp not found. Install with: winget install yt-dlp.yt-dlp\n" +
                  "Or set YTDLP_PATH in your .env.",
              ),
            );
          } else {
            reject(new Error(`yt-dlp error: ${stderr || err.message}`));
          }
          return;
        }
        const url = stdout.trim().split("\n")[0];
        if (!url) reject(new Error("yt-dlp returned no URL"));
        else resolve(url);
      },
    );
  });
}

module.exports = { getAudioResource };
