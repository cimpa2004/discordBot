-- V3__migrate_sounds_to_aws.sql
-- This migration updates the file_path column in the sounds table to point to AWS S3 URLs.
-- Adjust the bucket name and region as needed.

UPDATE sounds
SET file_path =
  'https://discordbot-sounds.s3.eu-north-1.amazonaws.com/' || name || '.mp3';