const fs = require("node:fs");
const path = require("node:path");
const logger = require("../utils/logger").createLogger("FFmpeg");

/**
 * Sets up FFmpeg binary path and creates accessible wrappers
 * @returns {string|null} The FFmpeg binary path if found, null otherwise
 */
function setupFfmpeg() {
  try {
    let ffmpegBinary = null;

    // Try to get ffmpeg binary path from ffmpeg-static or @ffmpeg-installer/ffmpeg
    try {
      const ffmpegStatic = require("ffmpeg-static");
      logger.debug("ffmpeg-static returned:", ffmpegStatic);

      // ffmpeg-static can return the path directly or an object with a path property
      if (typeof ffmpegStatic === "string") {
        ffmpegBinary = ffmpegStatic;
      } else if (ffmpegStatic && ffmpegStatic.path) {
        ffmpegBinary = ffmpegStatic.path;
      }
    } catch (e) {
      logger.debug("ffmpeg-static not found, trying @ffmpeg-installer/ffmpeg");
      try {
        ffmpegBinary = require("@ffmpeg-installer/ffmpeg").path;
      } catch (ee) {
        logger.warn(
          "No ffmpeg package found; ensure ffmpeg is installed on the system.",
        );
      }
    }

    logger.debug("Initial ffmpeg binary path:", ffmpegBinary);

    // If the path doesn't exist (common with pnpm), search for ffmpeg.exe in node_modules
    if (ffmpegBinary && !fs.existsSync(ffmpegBinary)) {
      logger.debug("Binary path doesn't exist, searching node_modules...");
      ffmpegBinary = searchForFfmpeg();
    }

    if (ffmpegBinary && fs.existsSync(ffmpegBinary)) {
      configureFfmpegEnvironment(ffmpegBinary);
      return ffmpegBinary;
    } else {
      logger.warn(
        `FFmpeg binary not found or does not exist. Path was: ${ffmpegBinary}`,
      );
      return null;
    }
  } catch (e) {
    logger.error("Error setting up FFmpeg:", e);
    return null;
  }
}

/**
 * Searches for ffmpeg.exe in node_modules directories
 * @returns {string|null} The path to ffmpeg.exe if found
 */
function searchForFfmpeg() {
  const searchPaths = [
    path.join(__dirname, "..", "..", "node_modules", ".pnpm"),
    path.join(__dirname, "..", "..", "node_modules"),
  ];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const found = findFfmpegRecursive(searchPath);
      if (found) {
        logger.debug("Found ffmpeg.exe at:", found);
        return found;
      }
    }
  }

  return null;
}

/**
 * Recursively searches for ffmpeg.exe in a directory
 * @param {string} dir - Directory to search
 * @returns {string|null} Path to ffmpeg.exe if found
 */
function findFfmpegRecursive(dir) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isFile() && item.name === "ffmpeg.exe") {
        return fullPath;
      } else if (item.isDirectory()) {
        const found = findFfmpegRecursive(fullPath);
        if (found) return found;
      }
    }
  } catch (e) {
    logger.warn(`Error searching for ffmpeg in ${dir}:`, e.message);
  }
  return null;
}

/**
 * Configures environment variables and creates wrapper executables
 * @param {string} ffmpegBinary - Path to the FFmpeg binary
 */
function configureFfmpegEnvironment(ffmpegBinary) {
  // Set environment variables for libraries that check them
  process.env.FFMPEG_PATH = ffmpegBinary;
  process.env.FFMPEG = ffmpegBinary;

  // Create a dedicated bin directory with FFmpeg copies
  const binDir = path.resolve(__dirname, "..", "..", ".ffmpeg-bin");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  createFfmpegWrappers(ffmpegBinary, binDir);
  addToPATH(binDir);

  logger.info(`FFmpeg binary setup complete. Binary location: ${ffmpegBinary}`);
  logger.debug(`Wrapper directory: ${binDir}`);
}

/**
 * Creates ffmpeg and avconv wrapper executables
 * @param {string} ffmpegBinary - Source FFmpeg binary path
 * @param {string} binDir - Destination directory for wrappers
 */
function createFfmpegWrappers(ffmpegBinary, binDir) {
  const isWin = process.platform === "win32";
  const wrapperNames = ["ffmpeg", "avconv"];

  for (const name of wrapperNames) {
    if (isWin) {
      // On Windows, copy the actual .exe file with the wrapper name
      const exePath = path.join(binDir, `${name}.exe`);
      try {
        if (!fs.existsSync(exePath)) {
          fs.copyFileSync(ffmpegBinary, exePath);
          logger.debug(`Created ${name}.exe in ${binDir}`);
        }
      } catch (e) {
        logger.warn(`Could not copy ${name}.exe:`, e.message);
      }
    } else {
      // On Unix-like systems, copy the binary directly
      const exePath = path.join(binDir, name);
      try {
        if (!fs.existsSync(exePath)) {
          fs.copyFileSync(ffmpegBinary, exePath);
          fs.chmodSync(exePath, 0o755);
          logger.debug(`Created ${name} in ${binDir}`);
        }
      } catch (e) {
        logger.warn(`Could not copy ${name}:`, e.message);
      }
    }
  }
}

/**
 * Adds a directory to the PATH environment variable
 * @param {string} binDir - Directory to add to PATH
 */
function addToPATH(binDir) {
  const currentPath = process.env.PATH || "";
  if (!currentPath.includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${currentPath}`;
    logger.debug(`Added ${binDir} to PATH`);
  }
}

module.exports = { setupFfmpeg };
