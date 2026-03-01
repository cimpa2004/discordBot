const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");

const { getAudioResource, prefetchResource } = require("./streamAudio");
const { formatNowPlaying } = require("./formatTrack");
const disconectTimeMS = require("../consts/disconectTimer");
const logger = require("./logger").createLogger("Queue");

const PREFETCH_TIMEOUT_MS = 15_000;

/**
 * Wraps a promise with a hard timeout. Rejects with a descriptive error if
 * the promise does not settle within `ms` milliseconds.
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`Timed out after ${ms / 1000}s waiting for: ${label}`),
        ),
      ms,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
      /** @type {{ track: object, promise: Promise } | null} */
      prefetch: null,
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
    logger.info(
      `Joining voice channel "${voiceChannel.name}" in guild ${message.guild.id}`,
    );
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    // Force re-create player too so it gets subscribed to the new connection
    state.player = null;
  }

  if (!state.player) {
    logger.info(`Creating new audio player for guild ${message.guild.id}`);
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
      logger.error("Player error:", err);
      state.isPlaying = false;
      state.nowPlaying = null;
      processQueue(guildId);
    });
  }
}

/**
 * Starts prefetching the first item in the queue for `guildId`.
 * If the prefetch does not produce a stream within PREFETCH_TIMEOUT_MS the
 * track is silently dropped from the queue and the next one is tried.
 * Idempotent — safe to call even when a prefetch is already in flight.
 */
function triggerPrefetch(guildId) {
  const state = guildStates.get(guildId);
  if (!state || state.queue.length === 0) return;

  const { track } = state.queue[0];

  // Already prefetching this exact track object — nothing to do.
  if (state.prefetch?.track === track) return;

  logger.info(`Prefetching "${track.title}" for guild ${guildId}`);

  const rawPromise = prefetchResource(track);

  const promise = withTimeout(
    rawPromise,
    PREFETCH_TIMEOUT_MS,
    track.title,
  ).catch((err) => {
    logger.warn(
      `Prefetch timed out / failed for "${track.title}" — removing from queue. Reason: ${err.message}`,
    );
    // Remove only if this track is still sitting at position 0
    if (state.queue.length > 0 && state.queue[0].track === track) {
      state.queue.shift();
    }
    if (state.prefetch?.track === track) state.prefetch = null;
    // Cascade: try the next track
    triggerPrefetch(guildId);
    // Do NOT re-throw: this promise is a background task. If nobody is awaiting
    // it yet (the common case — current track is still playing), re-throwing
    // causes an unhandled rejection crash. processQueue falls back to a fresh
    // getAudioResource() call whenever state.prefetch is null or stale.
  });

  state.prefetch = { track, promise };
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
    logger.info(
      `Queue exhausted for guild ${guildId} — disconnecting in ${disconectTimeMS / 1000}s if idle`,
    );
    clearTimeout(state.disconnectTimer);
    state.disconnectTimer = setTimeout(() => {
      if (
        !state.isPlaying &&
        state.connection &&
        state.connection.state.status !== "destroyed"
      ) {
        logger.info(
          `Disconnecting from voice channel in guild ${guildId} after idle timeout`,
        );
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

  logger.info(
    `Playing "${track.title}" by ${track.artist} [${track.provider}] — ${state.queue.length} track(s) remaining in guild ${guildId}`,
  );

  // Use an in-flight prefetch for this track when available; otherwise fetch
  // fresh — both paths are subject to the same 30 s hard timeout.
  let resourcePromise;
  if (state.prefetch?.track === track) {
    logger.info(`Using prefetched resource for "${track.title}"`);
    resourcePromise = state.prefetch.promise;
  } else {
    logger.info(`No prefetch available for "${track.title}", fetching now`);
    resourcePromise = withTimeout(
      getAudioResource(track),
      PREFETCH_TIMEOUT_MS,
      track.title,
    );
  }
  state.prefetch = null;

  try {
    const resource = await resourcePromise;
    state.player.play(resource);
    await textChannel.send(formatNowPlaying(track));
    // Kick off the prefetch for the next track while this one plays
    triggerPrefetch(guildId);
  } catch (err) {
    logger.error("Playback error:", err);
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
    logger.info(
      `Queued ${tracks.length} track(s) next [${provider}/${type}] in guild ${guildId} (queue length: ${state.queue.length})`,
    );
  } else {
    state.queue.push(...items);
    logger.info(
      `Enqueued ${tracks.length} track(s) [${provider}/${type}] in guild ${guildId} (queue length: ${state.queue.length})`,
    );
  }

  if (!wasAlreadyPlaying) {
    processQueue(guildId);
  } else {
    // Something is already playing — start prefetching queue[0] if not already
    triggerPrefetch(guildId);
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
    logger.info(`Skip requested for guild ${guildId} but nothing is playing`);
    return { skipped: false };
  }
  const skippedTitle = state.nowPlaying?.title ?? "unknown track";
  logger.info(`Skipping "${skippedTitle}" in guild ${guildId}`);
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
  state.prefetch = null; // discard any in-flight prefetch for the old queue
  logger.info(`Cleared ${cleared} track(s) from queue in guild ${guildId}`);
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

/**
 * Pauses the music player so a sound effect can take over the voice connection.
 * Returns whether music was paused and the existing voice connection (if any).
 * @param {string} guildId
 * @returns {{ wasPaused: boolean, connection: import('@discordjs/voice').VoiceConnection|null }}
 */
function pauseForSound(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.player || !state.isPlaying) {
    return { wasPaused: false, connection: state?.connection ?? null };
  }
  logger.info(`Pausing music in guild ${guildId} for sound effect`);
  state.player.pause();
  return { wasPaused: true, connection: state.connection };
}

/**
 * Resumes the music player after a sound effect finishes.
 * Re-subscribes the music player to the connection (the sound player will have
 * stolen the subscription) and unpauses it.
 * @param {string} guildId
 */
function resumeAfterSound(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.player || !state.connection) return;
  if (state.connection.state.status === "destroyed") return;
  logger.info(`Resuming music in guild ${guildId} after sound effect`);
  state.connection.subscribe(state.player);
  state.player.unpause();
}

module.exports = {
  enqueue,
  getQueue,
  getNowPlaying,
  skip,
  clearQueue,
  pauseForSound,
  resumeAfterSound,
};
