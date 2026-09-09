CREATE TABLE IF NOT EXISTS mailbox_attachment_staging (
  message_id TEXT PRIMARY KEY,
  storage_keys_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
