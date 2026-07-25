PRAGMA foreign_keys = ON;

CREATE TABLE owner_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  settings_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO owner_state (id, settings_revision, created_at, updated_at)
VALUES (
  1,
  0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE owner_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (device_id) REFERENCES owner_devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_device ON auth_sessions(device_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE auth_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings_fields (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  revision INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES owner_devices(id)
);

CREATE INDEX idx_settings_fields_revision ON settings_fields(revision);

CREATE TABLE processed_mutations (
  mutation_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  applied_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES owner_devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_processed_mutations_created ON processed_mutations(created_at);

CREATE TABLE content_sections (
  section_key TEXT PRIMARY KEY,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by_device TEXT,
  FOREIGN KEY (updated_by_device) REFERENCES owner_devices(id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  device_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES owner_devices(id)
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
