module.exports = {
  name: "sound",
  description: "Join a voice channel and play a sound.",
  async execute(message, args) {
    try {
      const { playSound } = require("../utils/playSound");
      await playSound(message, args[0], (opts) => message.reply(opts));
    } catch (err) {
      console.error(err);
      return message.reply("Error: " + err.message);
    }
  },
};
