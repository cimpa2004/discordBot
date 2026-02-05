const { AudioPlayerStatus } = require("@discordjs/voice");
const disconectTimeMS = require("../consts/disconectTimer");

/**
 * Sets up auto-disconnect for a voice connection when audio finishes playing
 * @param {AudioPlayer} player - The audio player instance
 * @param {VoiceConnection} connection - The voice connection to manage
 */
function setupAutoDisconnect(player, connection) {
  player.on(AudioPlayerStatus.Idle, () => {
    setTimeout(() => {
      if (player.state.status === AudioPlayerStatus.Idle) {
        if (connection.state.status === "destroyed") return;
        connection.destroy();
      }
    }, disconectTimeMS);
  });

  player.on("error", console.error);
}

module.exports = { setupAutoDisconnect };
