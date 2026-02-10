-- V4__fix_s3_keys.sql
-- This migration updates the file_path column to only contain the S3 key (file name), not the full URL.

UPDATE sounds
SET file_path = regexp_replace(file_path, '^https://[^/]+/([^?]+)$', '\1');
