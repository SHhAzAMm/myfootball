-- Храним resets по категориям (JSON) прямо в users
ALTER TABLE users ADD COLUMN resets_json TEXT DEFAULT '{}';-- Храним resets по категориям (JSON) прямо в users
ALTER TABLE users ADD COLUMN resets_json TEXT DEFAULT '{}';