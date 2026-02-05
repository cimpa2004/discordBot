module.exports = {
  name: "ping",
  description: "Replies with Pong!",
  execute(message, args) {
    return message.reply("Pong!");
  },
};
