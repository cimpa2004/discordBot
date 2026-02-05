#!/usr/bin/env node
require("dotenv").config();

const dbService = require("./src/services/databaseService");

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  await dbService.connect();

  switch (command) {
    case "list":
      await listSounds();
      break;
    case "add":
      if (args.length < 3) {
        console.error("Usage: node manage-sounds.js add <name> <file_path>");
        process.exit(1);
      }
      await addSound(args[1], args[2]);
      break;
    case "remove":
      if (args.length < 2) {
        console.error("Usage: node manage-sounds.js remove <name>");
        process.exit(1);
      }
      await removeSound(args[1]);
      break;
    default:
      console.log("Usage:");
      console.log(
        "  node manage-sounds.js list                    - List all sounds",
      );
      console.log(
        "  node manage-sounds.js add <name> <path>       - Add a new sound",
      );
      console.log(
        "  node manage-sounds.js remove <name>           - Remove a sound",
      );
      process.exit(1);
  }

  await dbService.close();
}

async function listSounds() {
  try {
    const sounds = await dbService.getAllSounds();
    console.log("\n=== Sounds in Database ===\n");
    Object.entries(sounds).forEach(([name, path]) => {
      console.log(`  ${name}: ${path}`);
    });
    console.log(`\nTotal: ${Object.keys(sounds).length} sounds\n`);
  } catch (error) {
    console.error("Error listing sounds:", error);
    process.exit(1);
  }
}

async function addSound(name, filePath) {
  try {
    await dbService.addSound(name, filePath);
    console.log(`✓ Sound '${name}' added successfully`);
  } catch (error) {
    console.error("Error adding sound:", error);
    process.exit(1);
  }
}

async function removeSound(name) {
  try {
    const removed = await dbService.removeSound(name);
    if (removed) {
      console.log(`✓ Sound '${name}' removed successfully`);
    } else {
      console.log(`✗ Sound '${name}' not found`);
    }
  } catch (error) {
    console.error("Error removing sound:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
