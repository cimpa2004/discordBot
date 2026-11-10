const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} = require("@discordjs/voice");

const {
  getAudioResource,
  prefetchResource,
  stopAudioResource,
} = require("./streamAudio");
const { formatNowPlaying } = require("./formatTrack");
const disconectTimeMS = require("../consts/disconectTimer");
const logger = require("./logger").createLogger("Queue");

const RESOURCE_TIMEOUT_MS = 60_000;
const MIN_PLAYBACK_MS = 2_000;

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

function triggerPrefetch(state) {
  if (state.prefetch || state.queue.length === 0) return;

  const { track } = state.queue[0];
  logger.info(`Prefetching "${track.title}"`);
  const promise = prefetchResource(track).catch((err) => {
    logger.warn(`Prefetch failed for "${track.title}": ${err.message}`);
    return null;
  });
  state.prefetch = { track, promise };
}

async function clearPrefetch(state) {
  if (!state.prefetch) return;
  const pending = state.prefetch.promise;
  state.prefetch = null;
  const resource = await pending.catch(() => null);
  stopAudioResource(resource);
}

/**
 * Per-guild playback state.
 * @type {Map<string, {
 *   queue: Array<{track: object, textChannel: import('discord.js').TextChannel}>,
 *   player: import('@discordjs/voice').AudioPlayer|null,
 *   connection: import('@discordjs/voice').VoiceConnection|null,
 *   isPlaying: boolean,
 *   currentResource: import('@discordjs/voice').AudioResource|null,
 *   resourceStarted: boolean,
 *   resourceStartedAt: number,
 *   currentTextChannel: import('discord.js').TextChannel|null,
 *   prefetch: { track: object, promise: Promise<import('@discordjs/voice').AudioResource|null> }|null,
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
      currentResource: null,
      resourceStarted: false,
      resourceStartedAt: 0,
      currentTextChannel: null,
      prefetch: null,
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
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    state.connection.subscribe(state.player);
    attachPlayerHandlers(state, guildId);
  }
}

function attachPlayerHandlers(state, guildId) {
  const player = state.player;

  player.on("stateChange", (oldState, newState) => {
    logger.debug(
      `Audio player state: ${oldState.status} -> ${newState.status}`,
    );
  });

  player.on(AudioPlayerStatus.Playing, () => {
    if (state.player === player && state.currentResource) {
      state.resourceStarted = true;
      state.resourceStartedAt = Date.now();
      logger.debug("Audio resource entered Playing state");
    }
  });

  player.on("stateChange", (oldState, newState) => {
    if (state.player !== player) return;
    if (newState.status !== AudioPlayerStatus.Idle) return;
    if (oldState.status !== AudioPlayerStatus.Playing) {
      logger.warn(`Ignoring premature audio idle (${oldState.status} -> idle)`);
      return;
    }
    if (state.currentResource && !state.resourceStarted) {
      logger.error(
        "Audio player became idle before the resource entered Playing state",
      );
      const failedResource = state.currentResource;
      const failedTrack = state.nowPlaying;
      const failedTextChannel = state.currentTextChannel;
      state.currentResource = null;
      state.resourceStarted = false;
      state.resourceStartedAt = 0;
      stopAudioResource(failedResource);
      state.isPlaying = false;
      state.nowPlaying = null;
      state.currentTextChannel = null;
      if (failedTrack && failedTextChannel) {
        state.queue.unshift({
          track: failedTrack,
          textChannel: failedTextChannel,
        });
        logger.warn(
          `Re-queued "${failedTrack.title}" after premature audio idle`,
        );
        setTimeout(() => processQueue(guildId), 1000);
      }
      return;
    }
    const playbackMs = Date.now() - state.resourceStartedAt;
    const finishedTrack = state.nowPlaying;
    const finishedTextChannel = state.currentTextChannel;
    state.isPlaying = false;
    state.nowPlaying = null;
    state.currentResource = null;
    state.resourceStarted = false;
    state.resourceStartedAt = 0;
    state.currentTextChannel = null;
    if (playbackMs < MIN_PLAYBACK_MS && finishedTrack && finishedTextChannel) {
      state.queue.unshift({
        track: finishedTrack,
        textChannel: finishedTextChannel,
      });
      logger.warn(
        `Audio ended after ${playbackMs}ms; retrying "${finishedTrack.title}"`,
      );
      setTimeout(() => processQueue(guildId), 1000);
      return;
    }
    processQueue(guildId);
  });

  player.on("error", (err) => {
    if (state.player !== player) return;
    const errorResource = err.resource;
    if (
      errorResource &&
      state.currentResource &&
      errorResource !== state.currentResource
    ) {
      logger.debug("Ignoring error from a stale audio resource:", err);
      return;
    }
    logger.error("Player error:", err);
    state.isPlaying = false;
    state.nowPlaying = null;
    state.currentResource = null;
    state.resourceStarted = false;
    processQueue(guildId);
  });
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
  state.currentTextChannel = textChannel;

  logger.info(
    `Playing "${track.title}" by ${track.artist} [${track.provider}] — ${state.queue.length} track(s) remaining in guild ${guildId}`,
  );

  logger.info(`Fetching audio resource for "${track.title}"`);

  try {
    await entersState(
      state.connection,
      VoiceConnectionStatus.Ready,
      RESOURCE_TIMEOUT_MS,
    );
    let resource;
    if (state.prefetch?.track === track) {
      logger.info(`Using prefetched audio resource for "${track.title}"`);
      resource = await state.prefetch.promise;
      state.prefetch = null;
    } else {
      if (state.prefetch) {
        const staleResource = await state.prefetch.promise.catch(() => null);
        stopAudioResource(staleResource);
        state.prefetch = null;
      }
      resource = await withTimeout(
        getAudioResource(track),
        RESOURCE_TIMEOUT_MS,
        track.title,
      );
    }
    if (!resource) {
      throw new Error(`Unable to prepare audio for "${track.title}"`);
    }
    state.currentResource = resource;
    state.resourceStarted = false;
    state.resourceStartedAt = 0;
    state.player.play(resource);
    await textChannel.send(formatNowPlaying(track));
    triggerPrefetch(state);
  } catch (err) {
    logger.error("Playback error:", err);
    await textChannel
      .send(`❌ Skipping **${track.title}**: ${err.message}`)
      .catch(() => {});
    state.isPlaying = false;
    state.nowPlaying = null;
    state.currentResource = null;
    state.resourceStarted = false;
    state.resourceStartedAt = 0;
    state.currentTextChannel = null;
    await clearPrefetch(state);
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
    clearPrefetch(state);
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
  const skippedResource = state.currentResource;
  state.currentResource = null;
  state.resourceStarted = false;
  state.resourceStartedAt = 0;
  state.currentTextChannel = null;
  const oldPlayer = state.player;
  state.player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  state.connection.subscribe(state.player);
  attachPlayerHandlers(state, guildId);
  stopAudioResource(skippedResource);
  oldPlayer.stop(true);
  state.isPlaying = false;
  state.nowPlaying = null;
  processQueue(guildId);
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
  clearPrefetch(state);
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
