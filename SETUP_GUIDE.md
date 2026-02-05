# Discord Bot - PostgreSQL Setup Guide

Your Discord bot now uses a PostgreSQL database to store sound mappings! This guide will help you get everything running.

## 🚀 Quick Start

### 1. Start the Database

```bash
pnpm run db:up
```

This will start PostgreSQL in Docker.

**First time only:** Run migrations to create the tables:

```bash
pnpm run db:migrate
```

This creates and populates the `sounds` table with your existing sounds.

### 2. Configure Environment

If you don't have a `.env` file yet:

```bash
cp .env.example .env
```

Edit `.env` and add your Discord bot token:

```
DISCORD_TOKEN=your_actual_token_here
```

The default database settings work with the Docker setup.

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Bot

```bash
pnpm dev
```

## 📋 Requirements

- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Node.js** >= 20.0.0
- **pnpm** package manager

## 🛠️ Available Commands

### Database Management

```bash
pnpm run db:up        # Start database
pnpm run db:down      # Stop database (keeps data)
pnpm run db:reset     # Reset database (removes all data!)
pnpm run db:logs      # View database logs
pnpm run db:migrate   # Run migrations manually
```

### Sound Management

```bash
# List all sounds
node manage-sounds.js list

# Add a new sound
node manage-sounds.js add newSound sounds/newSound.mp3

# Remove a sound
node manage-sounds.js remove soundName
```

## 🗄️ Database Access

To access the PostgreSQL console:

```bash
docker exec -it discordbot-postgres psql -U discordbot -d discordbot
```

Useful SQL commands:

```sql
-- View all sounds
SELECT * FROM sounds;

-- Count sounds
SELECT COUNT(*) FROM sounds;

-- Search for a sound
SELECT * FROM sounds WHERE name LIKE '%winner%';

-- Exit console
\q
```

## 📁 Project Structure

```
├── docker-compose.yml          # Docker services configuration
├── flyway.conf                 # Flyway migration settings
├── migrations/                 # Database migrations
│   └── V1__create_sounds_table.sql
├── manage-sounds.js            # CLI tool for sound management
├── src/
│   ├── services/
│   │   └── databaseService.js  # Database connection & queries
│   └── consts/
│       └── sounds.js           # Sound fetching (now uses DB)
└── .env                        # Your configuration (not in git)
```

## 🔄 How It Works

1. **Sounds are stored in PostgreSQL** instead of a hardcoded JavaScript object
2. **The bot queries the database** when a sound command is used
3. **Flyway manages migrations** - run them manually when needed with `pnpm run db:migrate`
4. **Fallback to legacy sounds** if database connection fails

## ➕ Adding New Sounds

### Option 1: Using the CLI tool (Recommended)

```bash
node manage-sounds.js add myNewSound sounds/myNewSound.mp3
```

### Option 2: Directly in the database

```bash
docker exec -it discordbot-postgres psql -U discordbot -d discordbot
```

```sql
INSERT INTO sounds (name, file_path) VALUES ('myNewSound', 'sounds/myNewSound.mp3');
```

### Option 3: Create a new migration

Create `migrations/V2__add_new_sounds.sql`:

```sql
INSERT INTO sounds (name, file_path) VALUES
    ('newSound1', 'sounds/newSound1.mp3'),
    ('newSound2', 'sounds/newSound2.mp3')
ON CONFLICT (name) DO NOTHING;
```

Then run:

```bash
pnpm run db:migrate
```

## 🔧 Troubleshooting

### Port 5432 already in use

If you have PostgreSQL running locally:

```bash
# Stop local PostgreSQL (Windows)
net stop postgresql-x64-14

# Or change the port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead

# Then update DB_PORT in .env
DB_PORT=5433
```

### Database connection failed

1. Make sure Docker is running
2. Check if the container is up: `docker ps`
3. View logs: `pnpm run db:logs`
4. Restart: `pnpm run db:down && pnpm run db:up`

### Migrations not running

```bash
# Force re-run migrations
pnpm run db:migrate
```

### Reset everything

```bash
# WARNING: This deletes all data!
pnpm run db:reset
```

## 📚 More Information

- See [DATABASE_README.md](DATABASE_README.md) for detailed technical documentation
- Flyway documentation: https://flywaydb.org/documentation
- PostgreSQL: https://www.postgresql.org/docs/

## 🎵 Current Sounds

Your bot starts with these sounds:

- winner
- agostonEsAFasz
- feszultseg
- hopOnTheGame
- motivacio
- nemVagyokBuzi
- nincsPenz

Use `node manage-sounds.js list` to see the current list in your database.
