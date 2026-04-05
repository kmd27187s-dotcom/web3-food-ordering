ALTER TABLE members ADD COLUMN registration_invite_code TEXT;
ALTER TABLE members ADD COLUMN proposal_ticket_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN vote_ticket_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN claimable_proposal_tickets INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN claimable_vote_tickets INTEGER NOT NULL DEFAULT 0;

UPDATE members
SET registration_invite_code = 'member-' || id
WHERE COALESCE(registration_invite_code, '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_registration_invite_code_unique
ON members(lower(registration_invite_code))
WHERE registration_invite_code IS NOT NULL AND registration_invite_code <> '';
