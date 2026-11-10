const DiscordOAuth2 = require("discord-oauth2");

class DiscordOAuthHelper {
  constructor() {
    this.oauth = new DiscordOAuth2({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      redirectUri: process.env.DISCORD_REDIRECT_URI,
    });
  }

  /**
   * Get authorization URL for Discord OAuth2
   * @returns {string} OAuth authorization URL
   */
  getAuthorizationUrl() {
    const scopes = ["identify", "guilds"];
    return this.oauth.generateAuthUrl({
      scope: scopes,
      state: Math.random().toString(36).substring(7),
    });
  }

  /**
   * Exchange authorization code for access token and user info
   * @param {string} code - Authorization code from Discord
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
   */
  async getTokenFromCode(code) {
    try {
      const tokenData = await this.oauth.tokenRequest({
        code,
        scope: ["identify", "guilds"],
        grantType: "authorization_code",
        redirectUri: process.env.DISCORD_REDIRECT_URI,
      });

      // Fetch user info with access token
      const user = await this.oauth.getUser(tokenData.access_token);

      return {
        user,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  /**
   * Get user's guilds
   * @param {string} accessToken - User's access token
   * @returns {Promise<Array>} Array of guild objects
   */
  async getUserGuilds(accessToken) {
    try {
      return await this.oauth.getUserGuilds(accessToken);
    } catch (error) {
      throw new Error(`Failed to fetch user guilds: ${error.message}`);
    }
  }

  /**
   * Get user information
   * @param {string} accessToken - User's access token
   * @returns {Promise<object>} User object
   */
  async getUser(accessToken) {
    try {
      return await this.oauth.getUser(accessToken);
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }
}

module.exports = new DiscordOAuthHelper();
