FROM node:20-alpine

# Install yt-dlp dependencies + yt-dlp binary
RUN apk add --no-cache python3 ffmpeg curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

CMD ["node", "src/index.js"]
