CREATE TABLE IF NOT EXISTS pending_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  proposal_id INTEGER,
  action TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  related_event TEXT NOT NULL DEFAULT '',
  related_order TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  confirmed_block INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(proposal_id) REFERENCES proposals(id)
);
