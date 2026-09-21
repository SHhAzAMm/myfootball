-- ═══════════════════════════════════════════════
--  Инвентарь пользователя
--  item_id → сколько у игрока этого предмета
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inventory (
  user_id  INTEGER NOT NULL,
  category TEXT    NOT NULL,
  item_id  TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);

-- ═══════════════════════════════════════════════
--  Лог открытий — аудит + аналитика
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  category   TEXT    NOT NULL,
  item_id    TEXT    NOT NULL,
  rarity     TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opens_user    ON opens(user_id);
CREATE INDEX IF NOT EXISTS idx_opens_created ON opens(created_at);
CREATE INDEX IF NOT EXISTS idx_opens_rarity  ON opens(rarity);
