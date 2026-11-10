-- Add guild support to sounds table
-- This migration enables per-server sound libraries

-- Drop the old unique constraint on name only
ALTER TABLE sounds DROP CONSTRAINT IF EXISTS sounds_name_key;

-- Add guild_id column (Discord guild IDs are uint64)
ALTER TABLE sounds ADD COLUMN IF NOT EXISTS guild_id BIGINT NOT NULL DEFAULT 0;

-- Add uploaded_by column (Discord user ID of uploader)
ALTER TABLE sounds ADD COLUMN IF NOT EXISTS uploaded_by BIGINT;

-- Add description column for sound metadata
ALTER TABLE sounds ADD COLUMN IF NOT EXISTS description TEXT;

-- Create new unique constraint: name must be unique per guild
ALTER TABLE sounds ADD CONSTRAINT sounds_guild_id_name_unique UNIQUE (guild_id, name);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sounds_guild_id ON sounds(guild_id);
CREATE INDEX IF NOT EXISTS idx_sounds_guild_id_name ON sounds(guild_id, name);
CREATE INDEX IF NOT EXISTS idx_sounds_uploaded_by ON sounds(uploaded_by);

-- Optional: Create a comment explaining guild_id usage
COMMENT ON COLUMN sounds.guild_id IS 'Discord guild (server) ID. Use 0 for global sounds available in all guilds.';
