const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const dbService = require("../../services/databaseService");
const { authMiddleware, guildMembershipMiddleware } = require("../middleware/auth");
const logger = require("../../utils/logger").createLogger("SoundsRoutes");

const router = express.Router();

// Configure multer for file uploads (store in memory temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    // Only allow MP3 files
    const allowedMimes = ["audio/mpeg", "audio/mp3"];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Only MP3 files are allowed"));
    }

    cb(null, true);
  },
});

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * GET /api/guilds/sounds/all
 * Get sounds for all guilds accessible by the user (including global guild 0)
 */
router.get("/sounds/all", authMiddleware, async (req, res) => {
  try {
    const userGuilds = req.user.guilds || [];
    const accessibleGuildIds = ["0", ...userGuilds.map((g) => String(g.id))];
    const guildNameById = new Map([
      ["0", "Global sounds"],
      ...userGuilds.map((g) => [String(g.id), g.name]),
    ]);

    const sounds = await dbService.getSoundsByGuildIds(accessibleGuildIds);
    const result = sounds.map((sound) => ({
      ...sound,
      guild_name: guildNameById.get(String(sound.guild_id)) || `Guild ${sound.guild_id}`,
    }));

    res.json(result);
  } catch (error) {
    logger.error("Failed to fetch all accessible sounds:", error);
    res.status(500).json({ error: "Failed to fetch sounds" });
  }
});

/**
 * GET /api/guilds/:guildId/sounds
 * Get all sounds for a guild
 */
router.get("/:guildId/sounds", authMiddleware, guildMembershipMiddleware, async (req, res) => {
  try {
    const sounds = await dbService.getGuildSounds(req.guildId);
    res.json(sounds);
  } catch (error) {
    logger.error("Failed to fetch guild sounds:", error);
    res.status(500).json({ error: "Failed to fetch sounds" });
  }
});

/**
 * GET /api/guilds/:guildId/sounds/:soundId
 * Get a specific sound
 */
router.get("/:guildId/sounds/:soundId", authMiddleware, guildMembershipMiddleware, async (req, res) => {
  try {
    const sound = await dbService.getSoundById(req.params.soundId);

    if (!sound) {
      return res.status(404).json({ error: "Sound not found" });
    }

    // Verify the sound belongs to the guild
    if (String(sound.guild_id) !== String(req.guildId)) {
      return res.status(403).json({ error: "You do not have access to this sound" });
    }

    res.json(sound);
  } catch (error) {
    logger.error("Failed to fetch sound:", error);
    res.status(500).json({ error: "Failed to fetch sound" });
  }
});

/**
 * POST /api/guilds/:guildId/sounds
 * Upload a new sound to the guild
 */
router.post(
  "/:guildId/sounds",
  authMiddleware,
  guildMembershipMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { soundName, description } = req.body;

      // Validate sound name
      if (!soundName || typeof soundName !== "string" || soundName.trim().length === 0) {
        return res.status(400).json({ error: "Invalid sound name" });
      }

      if (soundName.length > 50) {
        return res.status(400).json({ error: "Sound name must be 50 characters or less" });
      }

      // Check if sound with this name already exists in guild
      const existing = await dbService.getGuildSound(req.guildId, soundName.trim());
      if (existing) {
        return res.status(409).json({ error: "A sound with this name already exists in your guild" });
      }

      // Generate S3 key
      const sanitizedName = soundName.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
      const s3Key = `guild-${req.guildId}/${sanitizedName}-${uuidv4()}.mp3`;

      // Upload to S3
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: "audio/mpeg",
      };

      await s3.upload(uploadParams).promise();
      logger.info(`Uploaded sound to S3: ${s3Key}`);

      // Save to database
      const sound = await dbService.addGuildSound(
        req.guildId,
        soundName.trim(),
        s3Key,
        req.user.id,
        description || null,
      );

      res.status(201).json({
        id: sound.id,
        name: sound.name,
        description: sound.description,
        createdAt: sound.created_at,
        uploadedBy: sound.uploaded_by,
      });
    } catch (error) {
      logger.error("Failed to upload sound:", error);
      res.status(500).json({ error: error.message || "Failed to upload sound" });
    }
  }
);

/**
 * PATCH /api/guilds/:guildId/sounds/:soundId
 * Update a sound's metadata
 */
router.patch(
  "/:guildId/sounds/:soundId",
  authMiddleware,
  guildMembershipMiddleware,
  async (req, res) => {
    try {
      const sound = await dbService.getSoundById(req.params.soundId);

      if (!sound) {
        return res.status(404).json({ error: "Sound not found" });
      }

      // Verify the sound belongs to the guild
      if (String(sound.guild_id) !== String(req.guildId)) {
        return res.status(403).json({ error: "You do not have access to this sound" });
      }

      const { soundName, description } = req.body;
      const updates = {};

      if (soundName !== undefined) {
        if (typeof soundName !== "string" || soundName.trim().length === 0) {
          return res.status(400).json({ error: "Invalid sound name" });
        }
        if (soundName.length > 50) {
          return res.status(400).json({ error: "Sound name must be 50 characters or less" });
        }
        updates.name = soundName.trim();
      }

      if (description !== undefined) {
        if (typeof description !== "string" || description.length > 200) {
          return res.status(400).json({ error: "Description must be 200 characters or less" });
        }
        updates.description = description || null;
      }

      const updated = await dbService.updateGuildSound(req.params.soundId, updates);

      if (!updated) {
        return res.status(404).json({ error: "Sound not found" });
      }

      res.json({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        updatedAt: updated.updated_at,
      });
    } catch (error) {
      logger.error("Failed to update sound:", error);
      res.status(500).json({ error: error.message || "Failed to update sound" });
    }
  }
);

/**
 * DELETE /api/guilds/:guildId/sounds/:soundId
 * Delete a sound
 */
router.delete(
  "/:guildId/sounds/:soundId",
  authMiddleware,
  guildMembershipMiddleware,
  async (req, res) => {
    try {
      const sound = await dbService.getSoundById(req.params.soundId);

      if (!sound) {
        return res.status(404).json({ error: "Sound not found" });
      }

      // Verify the sound belongs to the guild
      if (String(sound.guild_id) !== String(req.guildId)) {
        return res.status(403).json({ error: "You do not have access to this sound" });
      }

      // Delete from S3
      try {
        await s3
          .deleteObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: sound.file_path,
          })
          .promise();
        logger.info(`Deleted sound from S3: ${sound.file_path}`);
      } catch (s3Error) {
        logger.warn(`Failed to delete from S3: ${sound.file_path}`, s3Error);
        // Continue with database deletion even if S3 fails
      }

      // Delete from database
      await dbService.removeGuildSound(req.params.soundId);

      res.json({ message: "Sound deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete sound:", error);
      res.status(500).json({ error: error.message || "Failed to delete sound" });
    }
  }
);

module.exports = router;
