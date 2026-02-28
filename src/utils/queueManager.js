const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");

const { getAudioResource } = require("./streamAudio");
const { formatNowPlaying } = require("./formatTrack");
const disconectTimeMS = require("../consts/disconectTimer");

/**
 * Per-guild playback state.
 * @type {Map<string, {
 *   queue: Array<{track: object, textChannel: import('discord.js').TextChannel}>,
 *   player: import('@discordjs/voice').AudioPlayer|null,
 *   connection: import('@discordjs/voice').VoiceConnection|null,
 *   isPlaying: boolean,
 *   disconnectTimer: NodeJS.Timeout|null
 * }>}
 */
const guildStates = new Map();

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    guildStates.set(guildId, {
      queue: [],
      player: null,
      connection: null,
      isPlaying: false,
      nowPlaying: null,
      disconnectTimer: null,
    });
  }
  return guildStates.get(guildId);
}

/**
 * Ensures a live player and connection exist for the guild.
 * Reuses them if already set up; creates new ones otherwise.
 */
function ensurePlayerConnection(state, message, guildId) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error("You need to be in a voice channel!");
  }

  // Re-create connection if it was destroyed
  if (!state.connection || state.connection.state.status === "destroyed") {
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    // Force re-create player too so it gets subscribed to the new connection
    state.player = null;
  }

  if (!state.player) {
    state.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    state.connection.subscribe(state.player);

    state.player.on(AudioPlayerStatus.Idle, () => {
      state.isPlaying = false;
      state.nowPlaying = null;
      processQueue(guildId);
    });

    state.player.on("error", (err) => {
      console.error("[Queue] Player error:", err);
      state.isPlaying = false;
      state.nowPlaying = null;
      processQueue(guildId);
    });
  }
}

/**
 * Internal: plays the next track in the guild's queue.
 * @param {string} guildId
 */
async function processQueue(guildId) {
  const state = getState(guildId);

  if (state.isPlaying) return;

  if (state.queue.length === 0) {
    // Queue exhausted — start idle disconnect timer
    clearTimeout(state.disconnectTimer);
    state.disconnectTimer = setTimeout(() => {
      if (
        !state.isPlaying &&
        state.connection &&
        state.connection.state.status !== "destroyed"
      ) {
        state.connection.destroy();
        state.player = null;
        state.connection = null;
      }
    }, disconectTimeMS);
    return;
  }

  // Cancel any pending disconnect
  clearTimeout(state.disconnectTimer);

  const { track, textChannel } = state.queue.shift();
  state.isPlaying = true;
  state.nowPlaying = track;

  try {
    const resource = await getAudioResource(track);
    state.player.play(resource);

    await textChannel.send(formatNowPlaying(track));
  } catch (err) {
    console.error("[Queue] Playback error:", err);
    await textChannel
      .send(`❌ Skipping **${track.title}**: ${err.message}`)
      .catch(() => {});
    state.isPlaying = false;
    state.nowPlaying = null;
    processQueue(guildId);
  }
}

/**
 * Adds tracks to the guild's queue and starts playback if idle.
 *
 * @param {import('discord.js').Message} message
 * @param {object[]} tracks    - Resolved track objects from a provider
 * @param {string}   provider  - Provider name (for display)
 * @param {string}   type      - "track" | "playlist" | "album"
 * @param {object}   [options]
 * @param {boolean}  [options.playNext=false] - Insert at the front of the queue instead of the end
 * @returns {{ addedCount: number, wasAlreadyPlaying: boolean }}
 */
function enqueue(message, tracks, provider, type, { playNext = false } = {}) {
  const guildId = message.guild.id;
  const state = getState(guildId);

  // Set up player/connection (throws if user not in voice channel)
  ensurePlayerConnection(state, message, guildId);

  const wasAlreadyPlaying = state.isPlaying || state.queue.length > 0;

  const items = tracks.map((track) => ({
    track,
    textChannel: message.channel,
  }));

  if (playNext) {
    // Insert at the front so these play immediately after the current track
    state.queue.unshift(...items);
  } else {
    state.queue.push(...items);
  }

  if (!wasAlreadyPlaying) {
    processQueue(guildId);
  }

  return { addedCount: tracks.length, wasAlreadyPlaying };
}

/**
 * Returns the current queue snapshot for a guild (read-only copy).
 * @param {string} guildId
 * @returns {Array<{track: object}>}
 */
function getQueue(guildId) {
  return [...(guildStates.get(guildId)?.queue ?? [])];
}

/**
 * Skips the currently playing track.
 * The AudioPlayerStatus.Idle listener will automatically start the next one.
 * @param {string} guildId
 * @returns {{ skipped: boolean }} Whether there was something to skip
 */
function skip(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.isPlaying || !state.player) {
    return { skipped: false };
  }
  // Stopping the player triggers the Idle event → processQueue
  state.player.stop(true);
  return { skipped: true };
}

/**
 * Clears all queued tracks (does not stop the currently playing track).
 * @param {string} guildId
 * @returns {{ cleared: number }} Number of tracks removed from the queue
 */
function clearQueue(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return { cleared: 0 };
  const cleared = state.queue.length;
  state.queue = [];
  return { cleared };
}

/**
 * Returns the currently playing track for a guild, or null if idle.
 * @param {string} guildId
 * @returns {object|null}
 */
function getNowPlaying(guildId) {
  return guildStates.get(guildId)?.nowPlaying ?? null;
}

module.exports = { enqueue, getQueue, getNowPlaying, skip, clearQueue };
