const logger = require("../utils/logger").createLogger("Sounds");

/**
 * Get a sound file path by name from the database
 * @param {string} soundName - The name of the sound
 * @param {string|number} [guildId=0] - Discord guild ID
 * @returns {Promise<string|null>} The file path or null if not found
 */
async function getSoundPath(soundName, guildId = 0) {
  const dbService = require("../services/databaseService");

  try {
    const filePath = await dbService.getSound(soundName, guildId);
    return filePath || null;
  } catch (error) {
    logger.warn("Database unavailable:", error.message);
    return null;
  }
}

/**
 * Get all sounds from the database
 * @param {string|number} [guildId=0] - Discord guild ID
 * @returns {Promise<Object|null>} Object mapping sound names to file paths or null if unavailable
 */
async function getAllSounds(guildId = 0) {
  const dbService = require("../services/databaseService");

  try {
    return await dbService.getAllSounds(guildId);
  } catch (error) {
    logger.warn("Database unavailable:", error.message);
    return null;
  }
}

module.exports = {
  getSoundPath,
  getAllSounds,
};
