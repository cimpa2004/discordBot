require("dotenv").config();

const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");

// Import setup modules
const { setupFfmpeg } = require("./setup/ffmpegSetup");
const { checkVoiceEncryption } = require("./setup/voiceSetup");
const { loadCommands } = require("./utils/commandLoader");
const { handleMessage } = require("./handlers/messageHandler");

// Setup FFmpeg
setupFfmpeg();

// Check voice encryption capabilities
checkVoiceEncryption();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
client.commands = loadCommands(commandsPath);

// Configuration
const PREFIX = process.env.PREFIX || "!";

// Event handlers
client.once("clientReady", () => {
  console.log(`${client.user.tag} is online`);
});

client.on("messageCreate", (message) => {
  handleMessage(message, client.commands, PREFIX);
});

// Login
client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
});
