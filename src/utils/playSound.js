const { joinVoiceChannelWithPlayer } = require("../utils/voiceChannelJoin");
const { setupAutoDisconnect } = require("../utils/setupAutoDisconnect");
const { createAudioResource } = require("@discordjs/voice");
const mapSound = require("../utils/mapSound");
const { getSignedSoundUrl } = require("../utils/s3SignedUrl");
const https = require("https");

/**
 * Plays a sound in a Discord voice channel using a signed S3 URL.
 * @param {object} message - Discord message object
 * @param {string} soundName - Name of the sound to play
 * @param {function} replyFn - Function to reply (message.reply or interaction.reply)
 */
async function playSound(message, soundName, replyFn) {
  try {
    const { connection, player } = joinVoiceChannelWithPlayer(message);
    const audioFile = await mapSound(soundName);
    if (!audioFile) {
      await replyFn({ content: "Sound not found.", ephemeral: true });
      return;
    }
    const signedUrl = getSignedSoundUrl(audioFile, 60);
    https
      .get(signedUrl, (res) => {
        const resource = createAudioResource(res);
        player.play(resource);
        setupAutoDisconnect(player, connection);
        replyFn({ content: `Playing ${soundName}!`, ephemeral: true });
      })
      .on("error", (err) => {
        console.error("Error streaming from S3:", err);
        replyFn({ content: "Error streaming sound.", ephemeral: true });
      });
  } catch (err) {
    console.error(err);
    await replyFn({ content: "Error: " + err.message, ephemeral: true });
  }
}

module.exports = { playSound };
