const fs = require("node:fs");
const path = require("node:path");
const logger = require("./logger");

/**
 * Loads all command files from the commands directory
 * @param {string} commandsPath - Path to the commands directory
 * @returns {Map} Map of command names to command objects
 */
function loadCommands(commandsPath) {
  const commands = new Map();

  if (!fs.existsSync(commandsPath)) {
    logger.warn(`Commands directory not found: ${commandsPath}`);
    return commands;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command && command.name) {
        commands.set(command.name, command);
        logger.debug(`Loaded command: ${command.name}`);
      } else {
        logger.warn(`Command file ${file} is missing name property`);
      }
    } catch (err) {
      logger.error(`Failed to load command: ${filePath}`, err);
    }
  }

  logger.info(`Loaded ${commands.size} command(s)`);
  return commands;
}

module.exports = { loadCommands };
