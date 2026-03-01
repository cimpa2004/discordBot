/** ANSI escape codes for terminal colours */
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

/** Numeric rank for each level – lower means more verbose */
const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Minimum level to emit.  Set LOG_LEVEL=debug in your env to see debug lines.
 * Defaults to "info" so that debug output is suppressed in production.
 */
const MIN_LEVEL =
  LEVEL_RANK[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVEL_RANK.info;

/** ISO timestamp string */
function timestamp() {
  return new Date().toISOString();
}

/** Builds the coloured prefix string for a log line */
function makePrefix(level, label) {
  const ts = `${C.dim}${timestamp()}${C.reset}`;

  let badge;
  switch (level) {
    case "debug":
      badge = `${C.gray}[DEBUG]${C.reset}`;
      break;
    case "info":
      badge = `${C.cyan}[INFO] ${C.reset}`;
      break;
    case "warn":
      badge = `${C.yellow}[WARN] ${C.reset}`;
      break;
    case "error":
      badge = `${C.bold}${C.red}[ERROR]${C.reset}`;
      break;
  }

  const scope = label ? `${C.dim}[${label}]${C.reset} ` : "";
  return `${ts} ${badge} ${scope}`;
}

/**
 * Creates a scoped logger.
 *
 * @param {string|null} label - Optional module/scope tag shown in every line.
 *
 * @example
 * const log = require('./logger').createLogger('Queue');
 * log.info('track started');   // 2026-03-01T… [INFO]  [Queue] track started
 * log.error('boom', err);      // prints error + stack trace automatically
 */
function createLogger(label) {
  return {
    /** Only visible when LOG_LEVEL=debug */
    debug(...args) {
      if (LEVEL_RANK.debug < MIN_LEVEL) return;
      console.debug(makePrefix("debug", label), ...args);
    },

    info(...args) {
      if (LEVEL_RANK.info < MIN_LEVEL) return;
      console.info(makePrefix("info", label), ...args);
    },

    warn(...args) {
      if (LEVEL_RANK.warn < MIN_LEVEL) return;
      console.warn(makePrefix("warn", label), ...args);
    },

    /**
     * Logs at error level.  Any Error objects passed in will have their
     * stack trace printed automatically as a debug-style follow-up line.
     */
    error(...args) {
      console.error(makePrefix("error", label), ...args);
      for (const arg of args) {
        if (arg instanceof Error && arg.stack) {
          console.error(`${C.gray}${arg.stack}${C.reset}`);
        }
      }
    },
  };
}

/** Root logger (no scope label).  Import createLogger for named loggers. */
const rootLogger = createLogger(null);
rootLogger.createLogger = createLogger;

module.exports = rootLogger;
