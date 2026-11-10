const express = require("express");
const jwt = require("jsonwebtoken");
const discordOAuth = require("../utils/discord");
const { JWT_SECRET } = require("../middleware/auth");
const logger = require("../../utils/logger").createLogger("AuthRoutes");

const router = express.Router();

/**
 * GET /api/auth/discord
 * Redirect to Discord OAuth authorization URL
 */
router.get("/discord", (req, res) => {
  try {
    const authUrl = discordOAuth.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error("Failed to generate auth URL:", error);
    res.status(500).json({ error: "Failed to generate authorization URL" });
  }
});

/**
 * GET /api/auth/callback
 * Handle Discord OAuth callback and exchange code for token
 */
router.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is missing" });
  }

  try {
    // Exchange code for token
    const { user, accessToken, refreshToken, expiresIn } =
      await discordOAuth.getTokenFromCode(code);

    // Fetch user's guilds
    let guilds = [];
    try {
      guilds = await discordOAuth.getUserGuilds(accessToken);
    } catch (error) {
      logger.warn("Failed to fetch user guilds:", error.message);
      // Continue anyway; guilds will be empty
    }

    // Create JWT token with user info
    const jwtToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email,
        guilds: guilds.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
        })),
        accessToken,
        refreshToken,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Redirect to frontend with token
    const redirectUrl = new URL(process.env.FRONTEND_URL || "http://localhost:5173");
    redirectUrl.searchParams.set("token", jwtToken);
    redirectUrl.searchParams.set("userId", user.id);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error("OAuth callback error:", error);
    const errorUrl = new URL(process.env.FRONTEND_URL || "http://localhost:5173");
    errorUrl.searchParams.set("error", error.message);
    res.redirect(errorUrl.toString());
  }
});

/**
 * GET /api/auth/user
 * Get current user info from JWT token
 */
router.get("/user", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      id: decoded.id,
      username: decoded.username,
      avatar: decoded.avatar,
      guilds: decoded.guilds,
    });
  } catch (error) {
    logger.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
