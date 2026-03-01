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

  async getAllSounds() {
    try {
      const result = await this.pool.query(
        "SELECT name, file_path FROM sounds ORDER BY name",
      );

      // Convert to the same format as the original soundMap
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

  async getSound(name) {
    try {
      const result = await this.pool.query(
        "SELECT file_path FROM sounds WHERE name = $1",
        [name],
      );

      return result.rows.length > 0 ? result.rows[0].file_path : null;
    } catch (error) {
      logger.error("Error fetching sound:", error);
      throw error;
    }
  }

  async addSound(name, filePath) {
    try {
      const result = await this.pool.query(
        "INSERT INTO sounds (name, file_path) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET file_path = $2, updated_at = CURRENT_TIMESTAMP RETURNING *",
        [name, filePath],
      );

      return result.rows[0];
    } catch (error) {
      logger.error("Error adding sound:", error);
      throw error;
    }
  }

  async removeSound(name) {
    try {
      const result = await this.pool.query(
        "DELETE FROM sounds WHERE name = $1 RETURNING *",
        [name],
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error("Error removing sound:", error);
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

// Export a singleton instance
const dbService = new DatabaseService();
module.exports = dbService;
