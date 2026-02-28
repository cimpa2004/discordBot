const { getQueue, getNowPlaying } = require("../utils/queueManager");
const { formatDuration } = require("../utils/formatTrack");

const PAGE_SIZE = 10;
const PREV = "◀️";
const NEXT = "▶️";
const COLLECTOR_TIMEOUT_MS = 60_000;

/**
 * Builds the embed-style text for a given page.
 */
function buildPage(nowPlaying, queue, page, totalPages) {
  const lines = [];

  if (nowPlaying) {
    lines.push(
      `🎵 **Now playing**`,
      `**${nowPlaying.title}** — ${nowPlaying.artist}`,
      `💿 ${nowPlaying.album} • ⏱️ ${formatDuration(nowPlaying.durationMs)}`,
      "",
    );
  }

  if (queue.length === 0) {
    lines.push("_The queue is empty._");
  } else {
    lines.push(`📋 **Queue** — Page ${page + 1} / ${totalPages}`);
    const start = page * PAGE_SIZE;
    queue.slice(start, start + PAGE_SIZE).forEach((item, i) => {
      const pos = start + i + 1;
      lines.push(
        `\`${String(pos).padStart(2, " ")}.\` **${item.track.title}** — ${item.track.artist} · ${formatDuration(item.track.durationMs)}`,
      );
    });

    if (queue.length > PAGE_SIZE) {
      lines.push(
        "",
        `_${queue.length} track${queue.length === 1 ? "" : "s"} total_`,
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  name: "queue",
  description: "Show the current playback queue with pagination.",

  async execute(message) {
    const guildId = message.guild.id;
    const nowPlaying = getNowPlaying(guildId);
    const queue = getQueue(guildId);

    if (!nowPlaying && queue.length === 0) {
      return message.reply("ℹ️ Nothing is playing and the queue is empty.");
    }

    const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
    let page = 0;

    const msg = await message.reply(
      buildPage(nowPlaying, queue, page, totalPages),
    );

    // No pagination controls needed for a single page
    if (totalPages <= 1) return;

    await msg.react(PREV);
    await msg.react(NEXT);

    const collector = msg.createReactionCollector({
      filter: (reaction, user) =>
        [PREV, NEXT].includes(reaction.emoji.name) &&
        user.id === message.author.id,
      time: COLLECTOR_TIMEOUT_MS,
    });

    collector.on("collect", async (reaction, user) => {
      // Remove the user's reaction so they can click again
      reaction.users.remove(user.id).catch(() => {});

      if (reaction.emoji.name === NEXT && page < totalPages - 1) page++;
      else if (reaction.emoji.name === PREV && page > 0) page--;
      else return;

      // Re-fetch live queue on each interaction
      const liveQueue = getQueue(guildId);
      const liveNow = getNowPlaying(guildId);
      const livePages = Math.max(1, Math.ceil(liveQueue.length / PAGE_SIZE));
      if (page >= livePages) page = livePages - 1;

      await msg
        .edit(buildPage(liveNow, liveQueue, page, livePages))
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.reactions.removeAll().catch(() => {});
    });
  },
};
