const https = require("https");

class SpotifyProvider {
  get name() {
    return "spotify";
  }

  get patterns() {
    return [/open\.spotify\.com/, /^spotify:(track|album|playlist):/];
  }

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.refreshToken = process.env.SPOTIFY_REFRESH_TOKEN || null;
    // market=from_token is invalid for client_credentials — use an explicit market code.
    // Set SPOTIFY_MARKET in .env to match your region (e.g. HU, GB, DE).
    this.market = process.env.SPOTIFY_MARKET || "HU";
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Prefer user OAuth token (required for playlist access since Spotify's 2024 API changes)
    if (this.refreshToken) {
      console.log("[Spotify] Using user OAuth token (refresh token)");
      return this._refreshUserToken();
    }

    console.warn(
      "[Spotify] WARNING: No SPOTIFY_REFRESH_TOKEN set — using client credentials. User playlists will return 403.",
    );
    return this._getClientCredentialsToken();
  }

  async _refreshUserToken() {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    }).toString();

    const token = await this._postToken(body);
    // Spotify may rotate the refresh token — persist the new one if provided
    if (token.refresh_token) {
      this.refreshToken = token.refresh_token;
    }
    console.log(`[Spotify] User token obtained. Scopes: ${token.scope}`);
    return token.access_token;
  }

  async _getClientCredentialsToken() {
    const body = "grant_type=client_credentials";
    const token = await this._postToken(body);
    return token.access_token;
  }

  _postToken(body) {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    return new Promise((resolve, reject) => {
      const options = {
        hostname: "accounts.spotify.com",
        path: "/api/token",
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.access_token) {
              reject(new Error("Failed to get Spotify token: " + data));
              return;
            }
            this.accessToken = parsed.access_token;
            this.tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  async apiRequest(path) {
    const token = await this.getAccessToken();

    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.spotify.com",
        path,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(
                new Error(
                  `Spotify API error ${parsed.error.status}: ${parsed.error.message} (path: ${path})`,
                ),
              );
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error("Failed to parse Spotify response"));
          }
        });
      });

      req.on("error", reject);
      req.end();
    });
  }

  parseSpotifyInput(input) {
    const uriMatch = input.match(
      /^spotify:(track|album|playlist):([a-zA-Z0-9]+)$/,
    );
    if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };

    const urlMatch = input.match(
      /open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/,
    );
    if (urlMatch) return { type: urlMatch[1], id: urlMatch[2] };

    return null;
  }

  formatTrack(track, albumOverride) {
    const artist = track.artists?.[0]?.name || "Unknown Artist";
    return {
      provider: "spotify",
      title: track.name,
      artist,
      album: albumOverride || track.album?.name || "Unknown Album",
      durationMs: track.duration_ms,
      // Used by play-dl to search YouTube
      searchQuery: `${track.name} ${artist}`,
    };
  }

  async getTrack(id) {
    const data = await this.apiRequest(
      `/v1/tracks/${id}?market=${this.market}`,
    );
    return this.formatTrack(data);
  }

  async getPlaylistTracks(id) {
    const tracks = [];
    // market is intentionally omitted for the playlist endpoint — it's not required
    // and Spotify can reject requests with market on user-owned playlists.
    let path = `/v1/playlists/${id}/tracks?limit=100`;

    while (path) {
      const data = await this.apiRequest(path); // throws on Spotify error

      for (const item of data.items ?? []) {
        // item.track can be null for local/unavailable tracks
        if (item.track) tracks.push(this.formatTrack(item.track));
      }

      // `next` is the full absolute URL to the next page, or null when done
      path = data.next
        ? new URL(data.next).pathname + new URL(data.next).search
        : null;
    }

    return tracks;
  }

  async getAlbumTracks(id) {
    const album = await this.apiRequest(
      `/v1/albums/${id}?market=${this.market}`,
    );

    const albumName = album.name;
    const tracks = album.tracks.items.map((t) =>
      this.formatTrack(t, albumName),
    );

    // Paginate if the album has more than the initial page (max 50 per request)
    let next = album.tracks.next;
    while (next) {
      const path = new URL(next).pathname + new URL(next).search;
      const page = await this.apiRequest(path);
      tracks.push(...page.items.map((t) => this.formatTrack(t, albumName)));
      next = page.next;
    }

    return tracks;
  }

  async searchTrack(query) {
    const data = await this.apiRequest(
      `/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=${this.market}`,
    );
    const track = data?.tracks?.items?.[0];
    if (!track) return null;
    return this.formatTrack(track);
  }

  async resolve(input) {
    const parsed = this.parseSpotifyInput(input);

    if (parsed) {
      if (parsed.type === "track") {
        const track = await this.getTrack(parsed.id);
        return { tracks: [track], type: "track" };
      }
      if (parsed.type === "playlist") {
        const tracks = await this.getPlaylistTracks(parsed.id);
        return { tracks, type: "playlist" };
      }
      if (parsed.type === "album") {
        const tracks = await this.getAlbumTracks(parsed.id);
        return { tracks, type: "album" };
      }
    }

    // Plain text → treat as search
    const track = await this.searchTrack(input);
    return { tracks: track ? [track] : [], type: "search" };
  }
}

module.exports = new SpotifyProvider();
