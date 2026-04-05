CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
