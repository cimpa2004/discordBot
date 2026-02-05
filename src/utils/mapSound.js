async function mapSound(soundName) {
  const { getSoundPath } = require("../consts/sounds.js");
  return await getSoundPath(soundName);
}

module.exports = mapSound;
