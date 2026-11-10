const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger").createLogger("AuthMiddleware");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verify JWT token and attach user to request
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Verify user is member of the guild
 */
function guildMembershipMiddleware(req, res, next) {
  const { guildId } = req.params;

  if (!guildId) {
    return res.status(400).json({ error: "Guild ID is required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Check if user has this guild in their guilds list
  const userGuilds = req.user.guilds || [];
  const guildIdStr = String(guildId);

  // Guild 0 is the global shared sound namespace and is available to any authenticated user.
  if (guildIdStr === "0") {
    req.guildId = guildIdStr;
    return next();
  }

  const hasGuild = userGuilds.some((g) => String(g.id) === guildIdStr);

  if (!hasGuild) {
    logger.warn(
      `User ${req.user.id} attempted to access guild ${guildId} they are not a member of`,
    );
    return res.status(403).json({ error: "You are not a member of this guild" });
  }

  req.guildId = guildIdStr;
  next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  logger.error("Unhandled error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = {
  authMiddleware,
  guildMembershipMiddleware,
  errorHandler,
  JWT_SECRET,
};
