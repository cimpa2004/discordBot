const { Pool } = require("pg");
const logger = require("../utils/logger").createLogger("Database");

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  initialize() {
    const config = {
      host: process.env.DB_HOST || "localhost",
      port: Number.parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "discordbot",
      user: process.env.DB_USER || "discordbot",
      password: process.env.DB_PASSWORD || "discordbot_password",
    };

    this.pool = new Pool(config);

    this.pool.on("error", (err) => {
      logger.error("Unexpected error on idle client", err);
    });

    logger.debug("Database connection pool initialized");
  }

  async connect() {
    if (!this.pool) {
      this.initialize();
    }

    try {
      const client = await this.pool.connect();
      logger.info("Successfully connected to database");
      client.release();
      return true;
    } catch (error) {
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async getAllSounds(guildId = 0) {
    try {
      const result = await this.pool.query(
        "SELECT name, file_path FROM sounds WHERE guild_id = $1 ORDER BY name",
        [String(guildId)],
      );

      const soundMap = {};
      result.rows.forEach((row) => {
        soundMap[row.name] = row.file_path;
      });

      return soundMap;
    } catch (error) {
      logger.error("Error fetching sounds:", error);
      throw error;
    }
  }

  async getSound(name, guildId = 0) {
    try {
      const result = await this.pool.query(
        "SELECT file_path FROM sounds WHERE guild_id = $1 AND name = $2",
        [String(guildId), name],
      );

      return result.rows.length > 0 ? result.rows[0].file_path : null;
    } catch (error) {
      logger.error("Error fetching sound:", error);
      throw error;
    }
  }

  async addSound(name, filePath, guildId = 0) {
    try {
      const result = await this.pool.query(
        "INSERT INTO sounds (guild_id, name, file_path) VALUES ($1, $2, $3) ON CONFLICT (guild_id, name) DO UPDATE SET file_path = EXCLUDED.file_path, updated_at = CURRENT_TIMESTAMP RETURNING *",
        [String(guildId), name, filePath],
      );

      return result.rows[0];
    } catch (error) {
      logger.error("Error adding sound:", error);
      throw error;
    }
  }

  async removeSound(name, guildId = 0) {
    try {
      const result = await this.pool.query(
        "DELETE FROM sounds WHERE guild_id = $1 AND name = $2 RETURNING *",
        [String(guildId), name],
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error("Error removing sound:", error);
      throw error;
    }
  }

  async getGuildSounds(guildId) {
    try {
      const result = await this.pool.query(
        "SELECT id, guild_id, name, file_path, description, uploaded_by, created_at, updated_at FROM sounds WHERE guild_id = $1 ORDER BY name",
        [String(guildId)],
      );

      return result.rows;
    } catch (error) {
      logger.error("Error fetching guild sounds:", error);
      throw error;
    }
  }

  async getSoundsByGuildIds(guildIds) {
    try {
      const normalizedGuildIds = [...new Set((guildIds || []).map((id) => String(id)))];

      if (normalizedGuildIds.length === 0) {
        return [];
      }

      const placeholders = normalizedGuildIds.map((_, index) => `$${index + 1}`).join(", ");
      const query =
        "SELECT id, guild_id, name, file_path, description, uploaded_by, created_at, updated_at FROM sounds WHERE guild_id IN (" +
        placeholders +
        ") ORDER BY name";

      const result = await this.pool.query(query, normalizedGuildIds);
      return result.rows;
    } catch (error) {
      logger.error("Error fetching sounds for guild list:", error);
      throw error;
    }
  }

  async getGuildSound(guildId, name) {
    try {
      const result = await this.pool.query(
        "SELECT * FROM sounds WHERE guild_id = $1 AND name = $2",
        [String(guildId), name],
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Error fetching guild sound:", error);
      throw error;
    }
  }

  async getSoundById(soundId) {
    try {
      const result = await this.pool.query("SELECT * FROM sounds WHERE id = $1", [
        soundId,
      ]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Error fetching sound by ID:", error);
      throw error;
    }
  }

  async addGuildSound(guildId, name, filePath, uploadedBy, description = null) {
    try {
      const result = await this.pool.query(
        "INSERT INTO sounds (guild_id, name, file_path, uploaded_by, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [String(guildId), name, filePath, String(uploadedBy), description],
      );

      return result.rows[0];
    } catch (error) {
      logger.error("Error adding guild sound:", error);
      throw error;
    }
  }

  async removeGuildSound(soundId) {
    try {
      const result = await this.pool.query(
        "DELETE FROM sounds WHERE id = $1 RETURNING *",
        [soundId],
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error("Error removing guild sound:", error);
      throw error;
    }
  }

  async updateGuildSound(soundId, updates) {
    try {
      const { name, description } = updates;
      const result = await this.pool.query(
        "UPDATE sounds SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
        [name, description, soundId],
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Error updating guild sound:", error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info("Database connection pool closed");
    }
  }
}

const dbService = new DatabaseService();
module.exports = dbService;
