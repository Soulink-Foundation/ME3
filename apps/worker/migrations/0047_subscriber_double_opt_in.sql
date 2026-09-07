ALTER TABLE subscribers ADD COLUMN confirmation_token_hash TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_expires_at TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_requested_at TEXT;
