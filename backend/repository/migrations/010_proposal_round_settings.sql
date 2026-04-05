ALTER TABLE proposals ADD COLUMN proposal_date TEXT NOT NULL DEFAULT '';
ALTER TABLE proposals ADD COLUMN max_options INTEGER NOT NULL DEFAULT 5;

UPDATE proposals
SET proposal_date = substr(created_at, 1, 10)
WHERE proposal_date = '';
