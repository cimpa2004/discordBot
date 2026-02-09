-- Create sounds table
CREATE TABLE IF NOT EXISTS sounds (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX idx_sounds_name ON sounds(name);

-- Insert existing sounds from the sounds.js file
INSERT INTO sounds (name, file_path) VALUES
    ('winner', 'sounds/winnerWinner.mp3'),
    ('agostonEsAFasz', 'sounds/agostonEsAFasz.mp3'),
    ('feszultseg', 'sounds/feszultseg.mp3'),
    ('hopOnTheGame', 'sounds/hopOnTheGame.mp3'),
    ('motivacio', 'sounds/motivacio.mp3'),
    ('nemVagyokBuzi', 'sounds/nemVagyokBuzi.mp3'),
    ('nincsPenz', 'sounds/nincsPenz.mp3')
ON CONFLICT (name) DO NOTHING;
