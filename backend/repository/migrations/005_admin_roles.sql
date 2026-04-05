ALTER TABLE members ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

UPDATE members
SET is_admin = 1
WHERE id = (
  SELECT MIN(id) FROM members
)
AND NOT EXISTS (
  SELECT 1 FROM members WHERE is_admin = 1
);
