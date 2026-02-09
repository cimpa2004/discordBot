const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
  name: "leave",
  description: "Leave the voice channel.",
  async execute(message, args) {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply("You need to be in a voice channel!");
    }

    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      return message.reply("Left the voice channel.");
    } else {
      return message.reply("I'm not in a voice channel.");
    }
  },
};
