module.exports = {
  name: "join",
  description: "Join the voice channel.",
  async execute(message, args) {
    const { joinVoiceChannelWithPlayer } = require("../utils/voiceChannelJoin");
    try {
      joinVoiceChannelWithPlayer(message);
      return message.reply("Joined the voice channel!");
    } catch (err) {
      console.error(err);
      return message.reply("Error: " + err.message);
    }
  },
};
