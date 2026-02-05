module.exports = {
  name: "sound",
  description: "Join a voice channel and play a sound.",
  async execute(message, args) {
    const { createAudioResource } = require("@discordjs/voice");
    const { joinVoiceChannelWithPlayer } = require("../utils/voiceChannelJoin");
    const { setupAutoDisconnect } = require("../utils/setupAutoDisconnect");

    try {
      const { connection, player } = joinVoiceChannelWithPlayer(message);

      const mapSound = require("../utils/mapSound");
      const audioFile = mapSound(args[0]);
      if (!audioFile) {
        return message.reply("Sound not found.");
      }
      const resource = createAudioResource(audioFile);

      player.play(resource);
      setupAutoDisconnect(player, connection);

      return message.reply("Playing...");
    } catch (err) {
      console.error(err);
      return message.reply("Error: " + err.message);
    }
  },
};
