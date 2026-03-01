const {
  joinVoiceChannel,
  createAudioPlayer,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const logger = require("./logger").createLogger("Voice");

/**
 * Joins a voice channel and creates an audio player
 * @param {Message} message - The Discord message object
 * @returns {{connection: VoiceConnection, player: AudioPlayer}} The connection and player objects
 * @throws {Error} If user is not in a voice channel
 */
function joinVoiceChannelWithPlayer(message) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    logger.error(
      `User ${message.author.tag} tried to join voice but is not in a channel`,
    );
    throw new Error("You need to be in a voice channel!");
  }

  logger.info(
    `Joining voice channel "${voiceChannel.name}" (${voiceChannel.id}) in guild ${message.guild.id}`,
  );
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
