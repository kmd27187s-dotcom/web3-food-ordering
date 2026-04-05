CREATE UNIQUE INDEX IF NOT EXISTS idx_members_wallet_address_unique
ON members(lower(wallet_address))
WHERE wallet_address IS NOT NULL AND wallet_address <> '';
