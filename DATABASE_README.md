# Docker Compose and Database Setup

This project uses Docker Compose to run a PostgreSQL database with Flyway migrations.

## Prerequisites

- Docker and Docker Compose installed
- Node.js >= 20.0.0
- pnpm package manager

## Database Setup

### 1. Start the Database

```bash
docker-compose up -d
```

This will start a PostgreSQL 16 container.

### 2. Run Migrations (First Time Only)

```bash
docker-compose up flyway
```

or use the npm script:

```bash
pnpm run db:migrate
```

This will:

- Run Flyway migrations
- Create the `sounds` table and populate it with existing sounds

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Discord bot token and database credentials (default values work with the Docker setup).

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Bot

```bash
pnpm start
```

For development with auto-reload:

```bash
pnpm dev
```

## Database Management

### Access PostgreSQL Console

```bash
docker exec -it discordbot-postgres psql -U discordbot -d discordbot
```

### View Sounds Table

```sql
SELECT * FROM sounds;
```

### Stop the Database

```bash
docker-compose down
```

To remove all data:

```bash
docker-compose down -v
```

### Run Migrations Manually

Migrations now only run when explicitly invoked:

```bash
docker-compose up flyway
```

Or use the npm script:

```bash
pnpm run db:migrate
```

## Adding New Sounds

Sounds are now stored in the database. You can add new sounds programmatically using the `databaseService`:

```javascript
const dbService = require("./src/services/databaseService");
await dbService.addSound("soundName", "sounds/filename.mp3");
```

## Flyway Migrations

Migration files are located in the `migrations/` directory. New migrations should follow the naming convention:

- `V{version}__{description}.sql` (e.g., `V2__add_sound_categories.sql`)

Migrations are automatically applied when starting the containers.
