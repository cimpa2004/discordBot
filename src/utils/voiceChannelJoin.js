const {
  joinVoiceChannel,
  createAudioPlayer,
  NoSubscriberBehavior,
} = require("@discordjs/voice");

/**
 * Joins a voice channel and creates an audio player
 * @param {Message} message - The Discord message object
 * @returns {{connection: VoiceConnection, player: AudioPlayer}} The connection and player objects
 * @throws {Error} If user is not in a voice channel
 */
function joinVoiceChannelWithPlayer(message) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error("You need to be in a voice channel!");
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });

  connection.subscribe(player);

  return { connection, player };
}

module.exports = { joinVoiceChannelWithPlayer };
