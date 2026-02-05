/**
 * Checks voice encryption capabilities and logs the available encryption method
 * @returns {string} The encryption method being used
 */
function checkVoiceEncryption() {
  try {
    const { VoiceConnection } = require("@discordjs/voice");
    console.log("@discordjs/voice loaded successfully");

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
          console.warn("No encryption library found for voice!");
        }
      }
    }

    console.log("Voice encryption method:", encryptionMethod);
    return encryptionMethod;
  } catch (e) {
    console.error("Failed to load @discordjs/voice:", e.message);
    return "error";
  }
}

module.exports = { checkVoiceEncryption };
