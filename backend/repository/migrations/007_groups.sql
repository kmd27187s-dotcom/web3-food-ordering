CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_member_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS group_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, member_id),
  FOREIGN KEY(group_id) REFERENCES groups(id),
  FOREIGN KEY(member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS group_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(group_id) REFERENCES groups(id),
  FOREIGN KEY(created_by) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS group_invite_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  invite_code TEXT NOT NULL,
  used_by_member_id INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(group_id) REFERENCES groups(id),
  FOREIGN KEY(used_by_member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_member_id ON group_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invite_usages_group_id ON group_invite_usages(group_id);
