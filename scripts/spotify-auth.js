/**
 * One-time script to obtain a Spotify refresh token with playlist-read-public scope.
 * Run once: node scripts/spotify-auth.js
 * Then copy the printed SPOTIFY_REFRESH_TOKEN value into your .env file.
 */

require("dotenv").config();
const http = require("http");
const https = require("https");
const { exec } = require("child_process");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const PORT = 8888;
const SCOPES = "playlist-read-private playlist-read-collaborative";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "❌  SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env",
  );
  process.exit(1);
}

const authUrl =
  `https://accounts.spotify.com/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}`;

console.log("\n1. Make sure your Spotify app has this Redirect URI added:");
console.log(`   ${REDIRECT_URI}`);
console.log(
  "   (Spotify Dashboard → your app → Edit Settings → Redirect URIs)\n",
);
console.log("2. Opening browser for authorization…\n");

// Open browser cross-platform
const openCmd =
  process.platform === "win32"
    ? `start "" "${authUrl}"`
    : process.platform === "darwin"
      ? `open "${authUrl}"`
      : `xdg-open "${authUrl}"`;
exec(openCmd);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") return;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.end("Authorization denied. You can close this tab.");
    console.error("❌  Authorization denied:", error);
    server.close();
    return;
  }

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  }).toString();

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64",
  );

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

  const tokenReq = https.request(options, (tokenRes) => {
    let data = "";
    tokenRes.on("data", (chunk) => (data += chunk));
    tokenRes.on("end", () => {
      const parsed = JSON.parse(data);
      if (!parsed.refresh_token) {
        res.end("Failed to get token. Check console.");
        console.error("❌  Token response:", parsed);
        server.close();
        return;
      }

      res.end("✅ Authorized! You can close this tab and check your terminal.");
      console.log("\n✅  Success! Add this to your .env file:\n");
      console.log(`SPOTIFY_REFRESH_TOKEN=${parsed.refresh_token}\n`);
      server.close();
    });
  });

  tokenReq.on("error", (err) => {
    console.error("❌  Token request error:", err);
    server.close();
  });

  tokenReq.write(body);
  tokenReq.end();
});

server.listen(PORT, () => {
  console.log(`Waiting for Spotify callback on port ${PORT}…`);
});
