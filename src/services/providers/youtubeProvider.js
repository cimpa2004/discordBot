const { execFile } = require("child_process");
const BaseProvider = require("./BaseProvider");

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

  async resolve(input) {
    // Normalise youtu.be short URLs
    const isPlaylist = /[?&]list=/.test(input) && !/[?&]v=/.test(input);

    const data = await this._fetchJson(input);

    // Playlist / channel
    if (data._type === "playlist" && Array.isArray(data.entries)) {
      const tracks = data.entries
        .filter((e) => e && e.id)
        .map((e) => this._formatEntry(e));
      return { tracks, type: "playlist" };
    }

    // Single video
    if (data.id) {
      return { tracks: [this._formatEntry(data)], type: "track" };
    }

    return { tracks: [], type: "track" };
  }
}

module.exports = new YouTubeProvider();
