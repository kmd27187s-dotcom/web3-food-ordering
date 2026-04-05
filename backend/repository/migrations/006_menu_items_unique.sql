CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_merchant_item
ON menu_items (merchant_id, item_id);
