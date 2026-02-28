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
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    return new Promise((resolve, reject) => {
      const body = "grant_type=client_credentials";
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
            if (parsed.access_token) {
              this.accessToken = parsed.access_token;
              this.tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
              resolve(this.accessToken);
            } else {
              reject(new Error("Failed to get Spotify token: " + data));
            }
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
            resolve(JSON.parse(data));
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
    const data = await this.apiRequest(`/v1/tracks/${id}`);
    if (!data || data.error) return null;
    return this.formatTrack(data);
  }

  async getPlaylistTracks(id) {
    const data = await this.apiRequest(
      `/v1/playlists/${id}/tracks?fields=items(track(name,artists,duration_ms,album(name)))&limit=50`,
    );
    if (!data || data.error) return [];
    return data.items
      .filter((i) => i.track)
      .map((i) => this.formatTrack(i.track));
  }

  async getAlbumTracks(id) {
    const data = await this.apiRequest(`/v1/albums/${id}`);
    if (!data || data.error) return [];
    return data.tracks.items.map((t) => this.formatTrack(t, data.name));
  }

  async searchTrack(query) {
    const data = await this.apiRequest(
      `/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
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
        return { tracks: track ? [track] : [], type: "track" };
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
