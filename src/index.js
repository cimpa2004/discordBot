require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Map();

const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command && command.name) client.commands.set(command.name, command);
    } catch (err) {
      console.error("Failed to load command:", filePath, err);
    }
  }
}

const PREFIX = process.env.PREFIX || "!";

client.once("clientReady", () => {
  console.log(`${client.user.tag} is online`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  const command = client.commands.get(cmd);
  if (command && typeof command.execute === "function") {
    try {
      command.execute(message, args);
    } catch (err) {
      console.error("Command execution error:", err);
      message.reply("There was an error executing that command.");
    }
  }
});

client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
});
