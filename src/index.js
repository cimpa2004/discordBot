require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

// Setup ffmpeg binary path and create accessible wrappers
try {
  // Try to get ffmpeg binary path from ffmpeg-static or @ffmpeg-installer/ffmpeg
  let ffmpegBinary = null;

  try {
    const ffmpegStatic = require("ffmpeg-static");
    console.log("ffmpeg-static returned:", ffmpegStatic);

    // ffmpeg-static can return the path directly or an object with a path property
    if (typeof ffmpegStatic === "string") {
      ffmpegBinary = ffmpegStatic;
    } else if (ffmpegStatic && ffmpegStatic.path) {
      ffmpegBinary = ffmpegStatic.path;
    }
  } catch (e) {
    console.log("ffmpeg-static not found, trying @ffmpeg-installer/ffmpeg");
    try {
      ffmpegBinary = require("@ffmpeg-installer/ffmpeg").path;
    } catch (ee) {
      console.warn(
        "No ffmpeg package found; ensure ffmpeg is installed on the system.",
      );
    }
  }

  console.log("Initial ffmpeg binary path:", ffmpegBinary);

  // If the path doesn't exist (common with pnpm), search for ffmpeg.exe in node_modules
  if (ffmpegBinary && !fs.existsSync(ffmpegBinary)) {
    console.log("Binary path doesn't exist, searching node_modules...");

    // Common locations for ffmpeg in node_modules
    const searchPaths = [
      path.join(__dirname, "..", "node_modules", ".pnpm"),
      path.join(__dirname, "..", "node_modules"),
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const findFfmpeg = (dir) => {
          try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
              const fullPath = path.join(dir, item.name);
              if (item.isFile() && item.name === "ffmpeg.exe") {
                return fullPath;
              } else if (item.isDirectory()) {
                const found = findFfmpeg(fullPath);
                if (found) return found;
              }
            }
          } catch (e) {
            // Skip directories we can't read
          }
          return null;
        };

        const found = findFfmpeg(searchPath);
        if (found) {
          ffmpegBinary = found;
          console.log("Found ffmpeg.exe at:", ffmpegBinary);
          break;
        }
      }
    }
  }

  if (ffmpegBinary && fs.existsSync(ffmpegBinary)) {
    // Set environment variables for libraries that check them
    process.env.FFMPEG_PATH = ffmpegBinary;
    process.env.FFMPEG = ffmpegBinary;

    // Create a dedicated bin directory with FFmpeg copies
    const binDir = path.resolve(__dirname, "..", ".ffmpeg-bin");
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const isWin = process.platform === "win32";
    const wrapperNames = ["ffmpeg", "avconv"];

    for (const name of wrapperNames) {
      if (isWin) {
        // On Windows, copy the actual .exe file with the wrapper name
        const exePath = path.join(binDir, `${name}.exe`);
        try {
          if (!fs.existsSync(exePath)) {
            fs.copyFileSync(ffmpegBinary, exePath);
            console.log(`Created ${name}.exe in ${binDir}`);
          }
        } catch (e) {
          console.warn(`Could not copy ${name}.exe:`, e.message);
        }
      } else {
        // On Unix-like systems, copy the binary directly
        const exePath = path.join(binDir, name);
        try {
          if (!fs.existsSync(exePath)) {
            fs.copyFileSync(ffmpegBinary, exePath);
            fs.chmodSync(exePath, 0o755);
            console.log(`Created ${name} in ${binDir}`);
          }
        } catch (e) {
          console.warn(`Could not copy ${name}:`, e.message);
        }
      }
    }

    // Add binDir to PATH if not already present
    const currentPath = process.env.PATH || "";
    if (!currentPath.includes(binDir)) {
      process.env.PATH = `${binDir}${path.delimiter}${currentPath}`;
      console.log(`Added ${binDir} to PATH`);
    }

    console.log(
      `FFmpeg binary setup complete. Binary location: ${ffmpegBinary}`,
    );
    console.log(`Wrapper directory: ${binDir}`);
  } else {
    console.warn(
      `FFmpeg binary not found or does not exist. Path was: ${ffmpegBinary}`,
    );
  }
} catch (e) {
  console.error("Error setting up FFmpeg:", e.message);
  console.error(e.stack);
}

const { Client, GatewayIntentBits } = require("discord.js");

// Check voice encryption capabilities
try {
  const { VoiceConnection } = require("@discordjs/voice");
  console.log("@discordjs/voice loaded successfully");

  // Try to load encryption libraries
  let encryptionMethod = "none";
  try {
    require("sodium-native");
    encryptionMethod = "sodium-native";
  } catch (e) {
    try {
      require("libsodium-wrappers");
      encryptionMethod = "libsodium-wrappers";
    } catch (e2) {
      try {
        require("tweetnacl");
        encryptionMethod = "tweetnacl";
      } catch (e3) {
        console.warn("No encryption library found for voice!");
      }
    }
  }
  console.log("Voice encryption method:", encryptionMethod);
} catch (e) {
  console.error("Failed to load @discordjs/voice:", e.message);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
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
