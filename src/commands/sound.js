module.exports = {
  name: "sound",
  description: "Join a voice channel and play a sound.",
  async execute(message, args) {
    const path = require("path");
    const {
      joinVoiceChannel,
      createAudioPlayer,
      createAudioResource,
      NoSubscriberBehavior,
      AudioPlayerStatus,
    } = require("@discordjs/voice");

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply("You need to be in a voice channel!");
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      });

      const audioFile = path.join(__dirname, "..", "..", "sounds", "bell.mp3");
      const resource = createAudioResource(audioFile);

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

      player.on("error", console.error);

      return message.reply("Playing...");
    } catch (err) {
      console.error(err);
      return message.reply("Error: " + err.message);
    }
  },
};
