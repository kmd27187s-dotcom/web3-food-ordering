CREATE TABLE IF NOT EXISTS proposal_chain_map (
  local_proposal_id INTEGER NOT NULL UNIQUE,
  chain_proposal_id INTEGER NOT NULL UNIQUE,
  FOREIGN KEY(local_proposal_id) REFERENCES proposals(id)
);

CREATE TABLE IF NOT EXISTS proposal_option_chain_map (
  local_option_id INTEGER NOT NULL UNIQUE,
  local_proposal_id INTEGER NOT NULL,
  chain_option_index INTEGER NOT NULL,
  UNIQUE(local_proposal_id, chain_option_index),
  FOREIGN KEY(local_option_id) REFERENCES proposal_options(id),
  FOREIGN KEY(local_proposal_id) REFERENCES proposals(id)
);

CREATE TABLE IF NOT EXISTS applied_chain_events (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  applied_at TEXT NOT NULL,
  PRIMARY KEY(tx_hash, log_index)
);
