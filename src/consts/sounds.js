/**
 * Get a sound file path by name from the database
 * @param {string} soundName - The name of the sound
 * @returns {Promise<string|null>} The file path or null if not found
 */
async function getSoundPath(soundName) {
  const dbService = require("../services/databaseService");

  try {
    const filePath = await dbService.getSound(soundName);
    return filePath || null;
  } catch (error) {
    console.warn("Database unavailable: ", error.message);
    return null;
  }
}

/**
 * Get all sounds from the database
 * @returns {Promise<Object|null>} Object mapping sound names to file paths or null if unavailable
 */
async function getAllSounds() {
  const dbService = require("../services/databaseService");

  try {
    return await dbService.getAllSounds();
  } catch (error) {
    console.warn("Database unavailable:", error.message);
    return null;
  }
}

module.exports = {
  getSoundPath,
  getAllSounds,
};
