function mapSound(soundName) {
  const soundMap = require("../consts/sounds.js");
  return soundMap[soundName] || null;
}

module.exports = mapSound;
