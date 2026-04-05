CREATE TABLE IF NOT EXISTS faucet_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  wallet_address TEXT,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(member_id),
  FOREIGN KEY(member_id) REFERENCES members(id)
);
