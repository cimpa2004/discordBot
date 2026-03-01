const { getQueue, getNowPlaying } = require("../utils/queueManager");
const { formatDuration } = require("../utils/formatTrack");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const PAGE_SIZE = 10;
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

/**
 * Builds the pagination action row. Buttons are disabled when at the boundary.
 */
function buildRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("queue_prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("queue_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
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

    const msgOptions = {
      content: buildPage(nowPlaying, queue, page, totalPages),
    };
    if (totalPages > 1) msgOptions.components = [buildRow(page, totalPages)];

    const msg = await message.reply(msgOptions);

    // No pagination needed for a single page
    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({
      filter: (interaction) =>
        ["queue_prev", "queue_next"].includes(interaction.customId) &&
        interaction.user.id === message.author.id,
      time: COLLECTOR_TIMEOUT_MS,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "queue_next" && page < totalPages - 1)
        page++;
      else if (interaction.customId === "queue_prev" && page > 0) page--;

      // Re-fetch live queue on each interaction
      const liveQueue = getQueue(guildId);
      const liveNow = getNowPlaying(guildId);
      const livePages = Math.max(1, Math.ceil(liveQueue.length / PAGE_SIZE));
      if (page >= livePages) page = livePages - 1;

      await interaction.update({
        content: buildPage(liveNow, liveQueue, page, livePages),
        components: [buildRow(page, livePages)],
      });
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
