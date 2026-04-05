CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  wallet_address TEXT,
  registration_invite_code TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  token_balance INTEGER NOT NULL DEFAULT 0,
  proposal_ticket_count INTEGER NOT NULL DEFAULT 0,
  vote_ticket_count INTEGER NOT NULL DEFAULT 0,
  claimable_proposal_tickets INTEGER NOT NULL DEFAULT 0,
  claimable_vote_tickets INTEGER NOT NULL DEFAULT 0,
  last_daily_login_reward_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant_group TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_by_name TEXT NOT NULL,
  proposal_deadline TEXT NOT NULL,
  vote_deadline TEXT NOT NULL,
  order_deadline TEXT NOT NULL,
  winner_option_id INTEGER NOT NULL DEFAULT 0,
  rewards_applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  merchant_group TEXT NOT NULL,
  payout_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_wei INTEGER NOT NULL,
  description TEXT NOT NULL,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS proposal_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  merchant_id TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  proposer_member_id INTEGER NOT NULL,
  proposer_name TEXT NOT NULL,
  weighted_votes INTEGER NOT NULL DEFAULT 0,
  token_stake INTEGER NOT NULL DEFAULT 0,
  partial_refund INTEGER NOT NULL DEFAULT 0,
  winner_token_back INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(proposal_id) REFERENCES proposals(id),
  FOREIGN KEY(proposer_member_id) REFERENCES members(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  member_name TEXT NOT NULL,
  option_id INTEGER NOT NULL,
  token_amount INTEGER NOT NULL,
  vote_weight INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  wallet_hidden INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(proposal_id) REFERENCES proposals(id),
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(option_id) REFERENCES proposal_options(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  member_name TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  order_hash TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  status TEXT NOT NULL,
  signature_amount_wei TEXT NOT NULL,
  signature_expiry INTEGER NOT NULL,
  signature_value TEXT NOT NULL,
  signature_digest TEXT NOT NULL,
  signer_address TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(proposal_id) REFERENCES proposals(id),
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_wei INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS chain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  proposal_id INTEGER,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS sync_state (
  cursor_key TEXT PRIMARY KEY,
  last_synced_block INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT NOT NULL DEFAULT '',
  last_seen_block INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT NOT NULL DEFAULT ''
);
