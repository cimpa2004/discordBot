const { joinVoiceChannelWithPlayer } = require("../utils/voiceChannelJoin");
const { setupAutoDisconnect } = require("../utils/setupAutoDisconnect");
const {
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const mapSound = require("../utils/mapSound");
const { getSignedSoundUrl } = require("../utils/s3SignedUrl");
const { pauseForSound, resumeAfterSound } = require("./queueManager");
const https = require("https");
const logger = require("./logger").createLogger("Sound");

/**
 * Plays a sound effect in the guild's voice channel.
 * If music is currently playing it is paused first; once the sound finishes
 * the music player is re-subscribed to the connection and unpaused.
 *
 * @param {object} message - Discord message object
 * @param {string} soundName - Name of the sound to play
 * @param {function} replyFn - Function to reply (message.reply or interaction.reply)
 */
async function playSound(message, soundName, replyFn) {
  try {
    const guildId = message.guild?.id;

    const audioFile = await mapSound(soundName);
    if (!audioFile) {
      await replyFn({ content: "Sound not found.", ephemeral: true });
      return;
    }

    // Pause any currently playing music and retrieve the existing connection.
    const { wasPaused, connection: musicConnection } = guildId
      ? pauseForSound(guildId)
      : { wasPaused: false, connection: null };

    // Decide which connection + player to use.
    let connection;
    let soundPlayer;
    let ownConnection = false; // true when we created the connection ourselves

    if (musicConnection && musicConnection.state.status !== "destroyed") {
      // Reuse the music connection — subscribe a fresh temporary player.
      connection = musicConnection;
      soundPlayer = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      });
      connection.subscribe(soundPlayer);
    } else {
      // No active music connection — create one from scratch.
      const joined = joinVoiceChannelWithPlayer(message);
      connection = joined.connection;
      soundPlayer = joined.player;
      ownConnection = true;
    }

    const signedUrl = getSignedSoundUrl(audioFile, 60);

    https
      .get(signedUrl, (res) => {
        const resource = createAudioResource(res);
        soundPlayer.play(resource);
        replyFn({ content: `Playing ${soundName}!`, ephemeral: true });

        soundPlayer.once(AudioPlayerStatus.Idle, () => {
          if (guildId && wasPaused) {
            // Hand the connection back to the music player and unpause it.
            resumeAfterSound(guildId);
          } else if (ownConnection) {
            // No music was playing — set up the normal idle-disconnect behaviour.
            setupAutoDisconnect(soundPlayer, connection);
          }
        });

        soundPlayer.once("error", (err) => {
          logger.error("Sound player error:", err);
          if (guildId && wasPaused) {
            resumeAfterSound(guildId);
          }
        });
      })
      .on("error", (err) => {
        logger.error("Error streaming from S3:", err);
        replyFn({ content: "Error streaming sound.", ephemeral: true });
        // Still resume music if it was paused.
        if (guildId && wasPaused) {
          resumeAfterSound(guildId);
        }
      });
  } catch (err) {
    logger.error(err);
    await replyFn({ content: "Error: " + err.message, ephemeral: true });
  }
}

module.exports = { playSound };
