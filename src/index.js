require("dotenv").config();

const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");
const logger = require("./utils/logger");

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
    logger.info("Database initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    logger.warn("Bot will continue without database connection");
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
  logger.info(`${client.user.tag} is online`);
  await initializeDatabase();
});

client.on("messageCreate", (message) => {
  handleMessage(message, client.commands, PREFIX);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await dbService.close();
  client.destroy();
  process.exit(0);
});

// Login
client.login(process.env.BOT_TOKEN).catch((err) => {
  logger.error("Failed to login:", err);
});
