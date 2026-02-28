const {
  resolveInput,
  providers,
  DEFAULT_PROVIDER,
} = require("../services/providers/index");
const { joinVoiceChannelWithPlayer } = require("../utils/voiceChannelJoin");
const { setupAutoDisconnect } = require("../utils/setupAutoDisconnect");
const { getAudioResource } = require("../utils/streamAudio");

// --provider <name> flag that can be prepended to any query
const PROVIDER_FLAG = "--provider";

module.exports = {
  name: "play",
  description:
    "Play a track from any supported provider. Usage: !play [--provider <name>] <url|query>",

  async execute(message, args) {
    if (!args.length) {
      const available = [...providers.keys()].join(", ");
      return message.reply(
        `Please provide a URL or search query.\n` +
          `Usage: \`!play [--provider <${available}>] <url or search terms>\`\n` +
          `Default provider: **${DEFAULT_PROVIDER}**`,
      );
    }

    // Parse optional --provider flag
    let forcedProvider = null;
    let remaining = [...args];

    const flagIdx = remaining.indexOf(PROVIDER_FLAG);
    if (flagIdx !== -1) {
      forcedProvider = remaining[flagIdx + 1]?.toLowerCase();
      if (!forcedProvider) {
        return message.reply(
          `\`${PROVIDER_FLAG}\` requires a provider name. Available: ${[...providers.keys()].join(", ")}`,
        );
      }
      remaining.splice(flagIdx, 2); // remove flag and value
    }

    const input = remaining.join(" ");
    if (!input.trim()) {
      return message.reply(
        "Please provide a URL or search query after the provider flag.",
      );
    }

    const loadingMsg = await message.reply(
      `🔍 Looking up${forcedProvider ? ` on **${forcedProvider}**` : ""}: \`${input}\`...`,
    );

    try {
      const { tracks, type, provider } = await resolveInput(
        input,
        forcedProvider,
      );

      if (!tracks.length) {
        return loadingMsg.edit("❌ No results found for that query.");
      }

      const track = tracks[0];

      // Join voice channel before the potentially slow stream lookup
      const { connection, player } = joinVoiceChannelWithPlayer(message);

      const durationSec = Math.floor((track.durationMs || 0) / 1000);
      const minutes = Math.floor(durationSec / 60);
      const seconds = String(durationSec % 60).padStart(2, "0");

      const queueInfo =
        tracks.length > 1
          ? `\n📋 **${type === "playlist" ? "Playlist" : "Album"}**: ${tracks.length} tracks queued`
          : "";

      const resource = await getAudioResource(track);
      player.play(resource);
      setupAutoDisconnect(player, connection);

      await loadingMsg.edit(
        `🎵 **Now playing** (via ${provider})\n` +
          `**${track.title}** — ${track.artist}\n` +
          `💿 ${track.album} • ⏱️ ${minutes}:${seconds}` +
          queueInfo,
      );
    } catch (err) {
      console.error("Play command error:", err);
      await loadingMsg.edit(`❌ Error: ${err.message}`);
    }
  },
};
