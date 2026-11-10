const express = require("express");
const cors = require("cors");
const dbService = require("../services/databaseService");
const { errorHandler } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const soundsRoutes = require("./routes/sounds");
const logger = require("../utils/logger").createLogger("APIServer");

class APIServer {
  constructor() {
    this.app = express();
    this.port = process.env.API_PORT || 3001;
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || ["http://localhost:5173", "http://localhost:3000"],
        credentials: true,
      }),
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ limit: "10mb", extended: true }));

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Auth routes
    this.app.use("/api/auth", authRoutes);

    // Sounds routes
    this.app.use("/api/guilds", soundsRoutes);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: "Not found" });
    });

    // Error handler (must be last)
    this.app.use(errorHandler);
  }

  async initialize() {
    try {
      // Connect to database
      await dbService.connect();
      logger.info("Database connected");

      this.setupMiddleware();
      this.setupRoutes();

      logger.info("API server initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize API server:", error);
      throw error;
    }
  }

  start() {
    this.app.listen(this.port, () => {
      logger.info(`API server listening on port ${this.port}`);
      logger.info(`Health check: http://localhost:${this.port}/api/health`);
      logger.info(`Auth: http://localhost:${this.port}/api/auth/discord`);
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = APIServer;
