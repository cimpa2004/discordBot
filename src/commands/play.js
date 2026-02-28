const {
  resolveInput,
  providers,
  DEFAULT_PROVIDER,
} = require("../services/providers/index");
const { enqueue } = require("../utils/queueManager");
const { formatTrackLine } = require("../utils/formatTrack");

// --provider <name> flag that can be prepended to any query
const PROVIDER_FLAG = "--provider";
// --next flag: insert at the front of the queue
const NEXT_FLAG = "--next";

module.exports = {
  name: "play",
  description: `Play a track from any supported provider. Usage: !play [${NEXT_FLAG}] [${PROVIDER_FLAG} <name>] <url|query>`,
  async execute(message, args) {
    if (!args.length) {
      const available = [...providers.keys()].join(", ");
      return message.reply(
        `Please provide a URL or search query.\n` +
          `Usage: \`!play [${NEXT_FLAG}] [${PROVIDER_FLAG} <${available}>] <url or search terms>\`\n` +
          `Default provider: **${DEFAULT_PROVIDER}**`,
      );
    }

    // Parse optional --next flag
    let remaining = [...args];
    const playNext = remaining.includes(NEXT_FLAG);
    if (playNext) remaining.splice(remaining.indexOf(NEXT_FLAG), 1);

    // Parse optional --provider flag
    let forcedProvider = null;

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

      // Enqueue all resolved tracks; returns whether something was already playing
      const { addedCount, wasAlreadyPlaying } = enqueue(
        message,
        tracks,
        provider,
        type,
        { playNext },
      );

      if (addedCount === 1) {
        const track = tracks[0];

        if (wasAlreadyPlaying) {
          const queueLabel = playNext
            ? "▶️ **Playing next**"
            : "📋 **Added to queue**";
          await loadingMsg.edit(
            `${queueLabel} (via ${provider})\n${formatTrackLine(track)}`,
          );
        } else {
          // processQueue will send "Now playing" — just confirm the action
          await loadingMsg.edit(
            `✅ **Starting playback** (via ${provider})\n${formatTrackLine(track)}`,
          );
        }
      } else {
        // Playlist / album
        const collectionLabel = type === "playlist" ? "Playlist" : "Album";
        if (wasAlreadyPlaying) {
          const queueLabel = playNext
            ? `▶️ **Queued next — ${addedCount} tracks** from ${collectionLabel}`
            : `📋 **Added ${addedCount} tracks** from ${collectionLabel} to the queue`;
          await loadingMsg.edit(`${queueLabel} (via ${provider})`);
        } else {
          await loadingMsg.edit(
            `✅ **Starting playback** — ${collectionLabel} with ${addedCount} tracks (via ${provider})`,
          );
        }
      }
    } catch (err) {
      console.error("Play command error:", err);
      await loadingMsg.edit(`❌ Error: ${err.message}`);
    }
  },
};
