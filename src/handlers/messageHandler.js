/**
 * Handles incoming messages and executes commands
 * @param {Message} message - Discord message object
 * @param {Map} commands - Map of available commands
 * @param {string} prefix - Command prefix
 */
function handleMessage(message, commands, prefix) {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  const command = commands.get(cmd);
  if (command && typeof command.execute === "function") {
    try {
      command.execute(message, args);
    } catch (err) {
      console.error("Command execution error:", err);
      message.reply("There was an error executing that command.");
    }
  }
}

module.exports = { handleMessage };
