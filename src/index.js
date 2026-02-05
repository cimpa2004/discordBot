require("dotenv").config();

const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");

// Import setup modules
const { setupFfmpeg } = require("./setup/ffmpegSetup");
const { checkVoiceEncryption } = require("./setup/voiceSetup");
const { loadCommands } = require("./utils/commandLoader");
const { handleMessage } = require("./handlers/messageHandler");
const dbService = require("./services/databaseService");

// Setup FFmpeg
setupFfmpeg();

// Check voice encryption capabilities
checkVoiceEncryption();

// Initialize database connection
async function initializeDatabase() {
  try {
    await dbService.connect();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    console.log("Bot will continue without database connection");
  }
}

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
client.once("clientReady", async () => {
  console.log(`${client.user.tag} is online`);
  await initializeDatabase();
});

client.on("messageCreate", (message) => {
  handleMessage(message, client.commands, PREFIX);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await dbService.close();
  client.destroy();
  process.exit(0);
});

// Login
client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
});
