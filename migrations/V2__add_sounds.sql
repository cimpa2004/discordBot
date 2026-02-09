INSERT INTO sounds (name, file_path) VALUES
    ('yippie', 'sounds/yippie.mp3')
ON CONFLICT (name) DO NOTHING;