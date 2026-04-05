CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  proposal_id INTEGER,
  action TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(proposal_id) REFERENCES proposals(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_records_member_created_at
ON usage_records(member_id, created_at DESC, id DESC);
