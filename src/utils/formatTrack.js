/**
 * Formats a duration in milliseconds as "m:ss".
 * @param {number} durationMs
 * @returns {string}
 */
function formatDuration(durationMs) {
  const totalSec = Math.floor((durationMs || 0) / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = String(totalSec % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Returns a single-line track summary: "**Title** — Artist | 💿 Album • ⏱️ m:ss"
 * @param {object} track
 * @returns {string}
 */
function formatTrackLine(track) {
  return (
    `**${track.title}** — ${track.artist}\n` +
    `💿 ${track.album} • ⏱️ ${formatDuration(track.durationMs)}`
  );
}

/**
 * Returns the full "🎵 Now playing" message for a track.
 * @param {object} track
 * @returns {string}
 */
function formatNowPlaying(track) {
  return `🎵 **Now playing**\n${formatTrackLine(track)}`;
}

module.exports = { formatDuration, formatTrackLine, formatNowPlaying };
