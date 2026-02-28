const { clearQueue } = require("../utils/queueManager");

module.exports = {
  name: "clear",
  description: "Clear all tracks from the queue (current track keeps playing).",

  execute(message) {
    const { cleared } = clearQueue(message.guild.id);

    if (cleared === 0) {
      return message.reply("ℹ️ The queue is already empty.");
    }

    return message.reply(
      `🗑️ Cleared **${cleared}** track${cleared === 1 ? "" : "s"} from the queue.`,
    );
  },
};
