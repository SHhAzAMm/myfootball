-- Метка времени последнего ресета по каждой категории
ALTER TABLE users ADD COLUMN reset_at_json TEXT;

-- Бэкфилл total_opened для старых игроков (иначе в лидерборде 0)
UPDATE users SET total_opened = (
  SELECT COUNT(*) FROM opens WHERE opens.user_id = users.id AND source != 'craft'
);
UPDATE users SET total_collected = (
  SELECT COUNT(*) FROM inventory WHERE inventory.user_id = users.id AND count > 0
);