const { skip, getQueue } = require("../utils/queueManager");

module.exports = {
  name: "skip",
  description: "Skip the currently playing track.",

  execute(message) {
    const guildId = message.guild.id;
    const { skipped } = skip(guildId);

    if (!skipped) {
      return message.reply("❌ Nothing is playing right now.");
    }

    const remaining = getQueue(guildId).length;
    const nextInfo =
      remaining > 0
        ? `⏭️ Skipped. **${remaining}** track${remaining === 1 ? "" : "s"} remaining in queue.`
        : "⏭️ Skipped. Queue is now empty.";

    return message.reply(nextInfo);
  },
};
