module.exports = {
  name: "check",
  description: "Check if the bot is responsive.",
  execute(message, args) {
    return message.reply("I'm alive!").catch((err) => {
      console.error("Failed to send reply:", err);
    });
  },
};
