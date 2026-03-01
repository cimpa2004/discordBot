const { execFile } = require("child_process");
const playdl = require("play-dl");
const BaseProvider = require("./BaseProvider");
const logger = require("../../utils/logger").createLogger("YouTube");

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";

class YouTubeProvider extends BaseProvider {
  get name() {
    return "youtube";
  }

  get patterns() {
    return [/youtu\.be\//, /youtube\.com\/(watch|playlist|shorts)/];
  }

  /**
   * Runs yt-dlp with --flat-playlist -J to get full JSON metadata without downloading.
   * @param {string} url
   * @returns {Promise<object>}
   */
  _fetchJson(url) {
    return new Promise((resolve, reject) => {
      execFile(
        YTDLP_PATH,
        ["--flat-playlist", "-J", "--no-warnings", url],
        { maxBuffer: 50 * 1024 * 1024 }, // 50 MB — large playlists produce big JSON
        (err, stdout, stderr) => {
          if (err) {
            if (err.code === "ENOENT") {
              reject(new Error("yt-dlp not found. Set YTDLP_PATH in .env"));
            } else {
              reject(new Error(`yt-dlp error: ${stderr || err.message}`));
            }
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            reject(new Error("Failed to parse yt-dlp JSON output"));
          }
        },
      );
    });
  }

  /**
   * Converts a yt-dlp flat entry into a track object.
   * @param {object} entry
   * @returns {object}
   */
  _formatEntry(entry) {
    return {
      provider: "youtube",
      title: entry.title || "Unknown Title",
      artist: entry.uploader || entry.channel || "Unknown Artist",
      album: "YouTube",
      durationMs: (entry.duration || 0) * 1000,
      searchQuery: entry.title || "",
      // Pass the direct YouTube URL so streamAudio skips the search step
      youtubeUrl: `https://www.youtube.com/watch?v=${entry.id}`,
    };
  }

  /**
   * Searches YouTube via play-dl and returns the best track found, or null.
   * Prefers official Topic / VEVO channels.
   * @param {string} query
   * @returns {Promise<object|null>}
   */
  async searchTrack(query) {
    logger.info(`Searching YouTube for: "${query}"`);
    const results = await playdl.search(query, {
      source: { youtube: "video" },
      limit: 5,
    });

    if (!results.length) {
      logger.warn(`YouTube search returned no results for: "${query}"`);
      return null;
    }

    const best =
      results.find(
        (r) =>
          r.channel?.name?.endsWith("- Topic") ||
          r.channel?.name?.toUpperCase().includes("VEVO"),
      ) ?? results[0];

    const isOfficial = !!(
      best.channel?.name?.endsWith("- Topic") ||
      best.channel?.name?.toUpperCase().includes("VEVO")
    );

    const result = {
      provider: "youtube",
      title: best.title || "Unknown Title",
      artist: best.channel?.name || "Unknown",
      album: "YouTube",
      durationMs: (best.durationInSec || 0) * 1000,
      searchQuery: best.title || query,
      youtubeUrl: `https://www.youtube.com/watch?v=${best.id}`,
      _isOfficial: isOfficial,
    };
    logger.info(
      `YouTube search result: "${result.title}" by ${result.artist}${isOfficial ? " [official]" : ""}`,
    );
    return result;
  }

  async resolve(input) {
    // Normalise youtu.be short URLs
    const isPlaylist = /[?&]list=/.test(input) && !/[?&]v=/.test(input);

    logger.info(
      `Resolving YouTube ${isPlaylist ? "playlist" : "URL"}: ${input}`,
    );
    const data = await this._fetchJson(input);

    // Playlist / channel
    if (data._type === "playlist" && Array.isArray(data.entries)) {
      const tracks = data.entries
        .filter((e) => e && e.id)
        .map((e) => this._formatEntry(e));
      logger.info(
        `Loaded ${tracks.length} track(s) from YouTube playlist "${data.title || input}"`,
      );
      return { tracks, type: "playlist" };
    }

    // Single video
    if (data.id) {
      const track = this._formatEntry(data);
      logger.info(
        `Resolved YouTube video: "${track.title}" by ${track.artist}`,
      );
      return { tracks: [track], type: "track" };
    }

    logger.warn(`YouTube resolve returned no usable data for: ${input}`);
    return { tracks: [], type: "track" };
  }
}

module.exports = new YouTubeProvider();
