module.exports = {
  name: "sounds",
  description: "Lists all available sounds.",
  async execute(message, args) {
    const { getAllSounds } = require("../consts/sounds.js");

    try {
      const sounds = await getAllSounds();
      if (!sounds) {
        return message.reply("Sound database is currently unavailable.");
      }

      const soundList = Object.entries(sounds)
        .map(([name, path]) => `**${name}**: ${path}`)
        .join("\n");

      return message.reply(
        `Available sounds:\n${soundList}\n\nTotal: ${Object.keys(sounds).length} sounds`,
      );
    } catch (err) {
      console.error(err);
      return message.reply("Error fetching sounds: " + err.message);
    }
  },
};
