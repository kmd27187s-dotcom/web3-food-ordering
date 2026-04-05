-- Prevent duplicate votes: one vote per member per proposal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_proposal_member_unique
  ON votes(proposal_id, member_id);

-- Prevent duplicate proposals per round: one proposal per group+meal_period+date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_group_period_date_unique
  ON proposals(group_id, meal_period, proposal_date);

-- Prevent duplicate options per proposer: one option per member per proposal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_options_proposal_proposer_unique
  ON proposal_options(proposal_id, proposer_member_id);
