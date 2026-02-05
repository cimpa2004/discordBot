const fs = require("node:fs");
const path = require("node:path");

/**
 * Loads all command files from the commands directory
 * @param {string} commandsPath - Path to the commands directory
 * @returns {Map} Map of command names to command objects
 */
function loadCommands(commandsPath) {
  const commands = new Map();

  if (!fs.existsSync(commandsPath)) {
    console.warn(`Commands directory not found: ${commandsPath}`);
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
        console.log(`Loaded command: ${command.name}`);
      } else {
        console.warn(`Command file ${file} is missing name property`);
      }
    } catch (err) {
      console.error(`Failed to load command: ${filePath}`, err);
    }
  }

  console.log(`Loaded ${commands.size} command(s)`);
  return commands;
}

module.exports = { loadCommands };
