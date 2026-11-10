async function mapSound(soundName, guildId = 0) {
  const { getSoundPath } = require("../consts/sounds.js");
  const guildPath = await getSoundPath(soundName, guildId);
  if (guildPath) {
    return guildPath;
  }

  // Fallback to global sounds for backward compatibility.
  return await getSoundPath(soundName, 0);
}

module.exports = mapSound;
