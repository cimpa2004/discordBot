/**
 * Checks voice encryption capabilities and logs the available encryption method
 * @returns {string} The encryption method being used
 */
const logger = require("../utils/logger").createLogger("Voice");

function checkVoiceEncryption() {
  try {
    const { VoiceConnection } = require("@discordjs/voice");
    logger.info("@discordjs/voice loaded successfully");

    // Try to load encryption libraries in order of preference
    let encryptionMethod = "none";

    try {
      require("sodium-native");
      encryptionMethod = "sodium-native";
    } catch (e) {
      try {
        require("libsodium-wrappers");
        encryptionMethod = "libsodium-wrappers";
      } catch (e2) {
        try {
          require("tweetnacl");
          encryptionMethod = "tweetnacl";
        } catch (e3) {
          logger.warn("No encryption library found for voice!");
        }
      }
    }

    logger.info("Voice encryption method:", encryptionMethod);
    return encryptionMethod;
  } catch (e) {
    logger.error("Failed to load @discordjs/voice:", e);
    return "error";
  }
}

module.exports = { checkVoiceEncryption };
