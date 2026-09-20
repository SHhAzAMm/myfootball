-- Добавляем колонку для хранения общего числа ресетов
ALTER TABLE users ADD COLUMN total_resets INTEGER DEFAULT 0;

-- Индекс для сортировки лидерборда
CREATE INDEX IF NOT EXISTS idx_users_resets ON users(total_resets DESC);