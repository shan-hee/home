DROP TABLE IF EXISTS processed_mutations;
DROP TABLE IF EXISTS settings_fields;
DROP TABLE IF EXISTS owner_state;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('wallpaper')),
  variant TEXT NOT NULL CHECK (variant IN ('desktop', 'mobile')),
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_device TEXT NOT NULL,
  FOREIGN KEY (created_by_device) REFERENCES owner_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_assets_kind_variant_created
ON assets(kind, variant, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_mutations (
  mutation_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES owner_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_mutations_created
ON admin_mutations(created_at);
