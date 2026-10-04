// ═══════════════════════════════════════════════
//  BOXES BACKEND — v5
//  + серверные покупки ящиков и карт
//  + серверный крафт
//  + серверная ежедневка и бусты
// ═══════════════════════════════════════════════

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MAX_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const RESET_BASE = 30;
const CRAFT_AMOUNT = 10;
const CRAFT_UPGRADE = { common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythical' };

const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX_OPENS = 30;
const RATE_LIMIT_MAX_BUYS = 10;

// ← новое: лимиты на логин
const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // 15 минут
const LOGIN_MAX_PER_IP = 20;              // 20 неудачных с одного IP
const LOGIN_MAX_PER_EMAIL = 5;            // 5 неудачных на один email

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const DAILY_STREAK_RESET = 48 * 60 * 60 * 1000;

const SELL_VALUES = {
  common: 1, rare: 5, epic: 20, legendary: 100, mythical: 500,
};
const BOX_PRICES = { rare: 500, epic: 2000, legendary: 10000, mythical: 50000 };
const SHARD_BOX_PRICES = { common: 1, rare: 1, epic: 1, legendary: 2, mythical: 3 };
const SHARD_CARD_PRICE = 5;

const DAILY_REWARDS = [
  { type: 'coins',        icon: '🪙', title: '100 монет',         amount: 100 },
  { type: 'coins',        icon: '🪙', title: '250 монет',         amount: 250 },
  { type: 'coins',        icon: '🪙', title: '500 монет',         amount: 500 },
  { type: 'coins_shards', icon: '🎁', title: '200🪙 + 1💎',       coins: 200, shards: 1 },
  { type: 'shards',       icon: '💎', title: '1 осколок',         amount: 1 },
  { type: 'shards',       icon: '💎', title: '2 осколка',         amount: 2 },
  { type: 'shards',       icon: '💎', title: '3 осколка',         amount: 3 },
  { type: 'box',          icon: '📦', title: 'Редкий ящик',       boxRarity: 'rare' },
  { type: 'box',          icon: '📦', title: 'Эпический ящик',    boxRarity: 'epic' },
  { type: 'box',          icon: '📦', title: 'Легендарный ящик',  boxRarity: 'legendary' },
  { type: 'boost',        icon: '🔵', title: 'Буст редких',       boostType: 'rare' },
  { type: 'boost',        icon: '🟣', title: 'Буст эпик+',        boostType: 'epic' },
  { type: 'coins_shards', icon: '💎', title: '150🪙 + 2💎',       coins: 150, shards: 2 },
  { type: 'coins',        icon: '🪙', title: '1000 монет',        amount: 1000 },
];
const DAILY_CYCLE_LENGTH = DAILY_REWARDS.length;

const BOOST_INFO = {
  rare: { icon: '🔵', title: 'Буст редких', desc: '+30% к шансу редких', duration: 60 * 60 * 1000 },
  epic: { icon: '🟣', title: 'Буст эпик+',  desc: '+50% к шансу эпик+',  duration: 60 * 60 * 1000 },
};

// ─── Достижения ───
// stat — какое поле из статистики игрока сравнивается с target
const ACHIEVEMENTS = [
  { id: 'first_open',     icon: '🎁', name: 'Первый шаг',           desc: 'Открой первый бокс',           stat: 'total_opened',     target: 1,     reward: { coins: 100 } },
  { id: 'open_100',       icon: '📦', name: 'Сотня',                desc: 'Открой 100 боксов',            stat: 'total_opened',     target: 100,   reward: { coins: 1000 } },
  { id: 'open_1000',      icon: '📚', name: 'Тысячник',             desc: 'Открой 1000 боксов',           stat: 'total_opened',     target: 1000,  reward: { coins: 10000, shards: 5 } },
  { id: 'collect_50',     icon: '💼', name: 'Коллекционер',         desc: 'Собери 50 предметов',          stat: 'total_collected',  target: 50,    reward: { shards: 3 } },
  { id: 'legendary_10',   icon: '🟠', name: 'Легендарный охотник',  desc: 'Получи 10 легендарных',        stat: 'legendary_count',  target: 10,    reward: { coins: 5000 } },
  { id: 'mythical_3',     icon: '🔴', name: 'Мифический лорд',      desc: 'Получи 3 мифических',          stat: 'mythical_count',   target: 3,     reward: { coins: 15000, shards: 5 } },
  { id: 'craft_10',       icon: '⚗️', name: 'Плавильщик',           desc: 'Сделай 10 крафтов',            stat: 'craft_count',      target: 10,    reward: { coins: 2000 } },
  { id: 'reset_1',        icon: '🔄', name: 'Престиж',              desc: 'Сделай первый ресет',          stat: 'total_resets',     target: 1,     reward: { coins: 1000, shards: 1 } },
  { id: 'reset_10',       icon: '♻️', name: 'Ресет-мастер',         desc: 'Сделай 10 ресетов',            stat: 'total_resets',     target: 10,    reward: { coins: 20000, shards: 10 } },
  { id: 'streak_7',       icon: '🔥', name: 'Ежедневный',           desc: '7 дней стрика',                stat: 'daily_streak',     target: 7,     reward: { coins: 3000, shards: 3 } },
  { id: 'coins_10000',    icon: '💰', name: 'Богач',                desc: 'Накопи 10000 монет',           stat: 'coins',            target: 10000, reward: { shards: 5 } },
  { id: 'shards_50',      icon: '💎', name: 'Кристальный',          desc: 'Накопи 50 осколков',           stat: 'shards',           target: 50,    reward: { coins: 10000 } },
];
// ─── Квесты ───
const QUEST_DAILY_COUNT = 3;
const QUEST_WEEKLY_COUNT = 2;

const QUEST_POOL_DAILY = [
  { id: 'open_10',     icon: '📦', name: 'Открой 10 боксов',      type: 'open',      target: 10,  reward: { coins: 500 } },
  { id: 'open_25',     icon: '📦', name: 'Открой 25 боксов',      type: 'open',      target: 25,  reward: { coins: 1500 } },
  { id: 'open_50',     icon: '📦', name: 'Открой 50 боксов',      type: 'open',      target: 50,  reward: { coins: 3000, shards: 1 } },
  { id: 'craft_1',     icon: '⚗️', name: 'Сделай 1 крафт',        type: 'craft',     target: 1,   reward: { coins: 1000 } },
  { id: 'craft_3',     icon: '⚗️', name: 'Сделай 3 крафта',       type: 'craft',     target: 3,   reward: { coins: 2500 } },
  { id: 'epic_1',      icon: '🟣', name: 'Получи эпический',      type: 'epic',      target: 1,   reward: { coins: 1000 } },
  { id: 'legendary_1', icon: '🟠', name: 'Получи легендарный',    type: 'legendary', target: 1,   reward: { coins: 2000 } },
];

const QUEST_POOL_WEEKLY = [
  { id: 'w_open_200',    icon: '📦', name: 'Открой 200 боксов',     type: 'open',      target: 200, reward: { coins: 10000, shards: 3 } },
  { id: 'w_open_500',    icon: '📦', name: 'Открой 500 боксов',     type: 'open',      target: 500, reward: { coins: 25000, shards: 5 } },
  { id: 'w_craft_10',    icon: '⚗️', name: 'Сделай 10 крафтов',     type: 'craft',     target: 10,  reward: { coins: 10000, shards: 3 } },
  { id: 'w_legendary_5', icon: '🟠', name: 'Получи 5 легендарных',  type: 'legendary', target: 5,   reward: { coins: 20000, shards: 5 } },
  { id: 'w_mythical_2',  icon: '🔴', name: 'Получи 2 мифических',   type: 'mythical',  target: 2,   reward: { coins: 30000, shards: 10 } },
];

const CATALOG = {
  elements: {
    common:    ['fire', 'water', 'earth', 'air'],
    rare:      ['fog', 'sand', 'plant', 'cold'],
    epic:      ['light', 'slime', 'sound', 'ash', 'gas'],
    legendary: ['lava', 'electricity', 'venom', 'blood', 'rainbow'],
    mythical:  ['darkness', 'time'],
  },
  gems: {
    common:    ['agate', 'quartz', 'amber', 'onyx', 'pyrite'],
    rare:      ['aquamarine', 'garnet', 'tourmaline', 'malachite', 'obsidian', 'pearl'],
    epic:      ['amethyst', 'topaz', 'opal', 'moonstone'],
    legendary: ['alexandrite', 'ruby', 'emerald', 'sapphire'],
    mythical:  ['diamond'],
  },
  equipment: {
    common:    ['daggers', 'machete', 'nunchaku', 'shuriken', 'wood'],
    rare:      ['bow', 'crossbow', 'slingshot', 'spear'],
    epic:      ['axe', 'hammer', 'katana', 'saber', 'morgenstern'],
    legendary: ['sword', 'staff', 'chainmail', 'shield', 'helmet'],
    mythical:  ['crown'],
  },
};

const RARITY_CHANCES = { common: 50, rare: 25, epic: 15, legendary: 8, mythical: 2 };
const BOOST_CHANCES = {
  rare: { common: 35, rare: 40, epic: 15, legendary: 8, mythical: 2 },
  epic: { common: 40, rare: 23, epic: 22, legendary: 12, mythical: 3 },
};

// ─── Пароли ───
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 60000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);
  return `PBKDF2-SHA256$60000$${btoa(String.fromCharCode(...saltArray))}$${btoa(String.fromCharCode(...hashArray))}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash).split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(atob(parts[2]).split('').map(c => c.charCodeAt(0)));
  const originalHash = parts[3];
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const newHash = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return newHash === originalHash;
}

function generateToken() {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}
// IP из заголовков Cloudflare (всегда есть на CF Workers)
function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || 'unknown';
}

// Сколько неудачных попыток за окно
async function countFailedAttempts(env, ip, email, windowMs) {
  const since = Date.now() - windowMs;
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN ip = ? THEN 1 ELSE 0 END) as by_ip,
       SUM(CASE WHEN email = ? THEN 1 ELSE 0 END) as by_email
     FROM login_attempts
     WHERE created_at > ? AND success = 0`
  ).bind(ip, email, since).first();
  return {
    byIp: (row && row.by_ip) || 0,
    byEmail: (row && row.by_email) || 0,
  };
}

async function recordLoginAttempt(env, ip, email, success) {
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip, email, success, created_at) VALUES (?, ?, ?, ?)'
  ).bind(ip, email, success ? 1 : 0, Date.now()).run();
  // Чистим старые записи (старше суток) — раз в N попыток, не критично если чаще
  if (Math.random() < 0.05) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE created_at < ?')
      .bind(Date.now() - 24 * 60 * 60 * 1000).run();
  }
}
// ─── CORS ───
const ALLOWED_ORIGINS = [
  'https://mybox-game.pages.dev',
  'https://myfootball-1od.pages.dev',
];

function getCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// ─── Сессии ───
async function getSession(request, env, bodyOrNull) {
  let token = null;
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token && bodyOrNull && typeof bodyOrNull.token === 'string') token = bodyOrNull.token;
  if (!token) return null;

  const row = await env.DB.prepare(
    'SELECT token, user_id, created_at, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!row) return null;

  const now = Date.now();
  if (row.expires_at < now) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  if (now - row.created_at > SESSION_MAX_MS) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  if (row.expires_at - now < SESSION_TTL_MS - SESSION_REFRESH_THRESHOLD_MS) {
    const newExpiry = now + SESSION_TTL_MS;
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .bind(newExpiry, token).run();
  }
  return { userId: row.user_id, token };
}

// ─── Санитайзер: только profile и unlockedFrames ───
function sanitizeClientFields(data) {
  if (!data || typeof data !== 'object') return null;
  const out = {
    profile: { avatar: '🐱', frame: 'default', nickname: '' },
    unlockedFrames: [],
  };
  if (data.profile && typeof data.profile === 'object') {
    if (typeof data.profile.avatar === 'string' && data.profile.avatar.length <= 8) {
      out.profile.avatar = data.profile.avatar;
    }
    if (typeof data.profile.frame === 'string' && /^[a-z]{1,20}$/.test(data.profile.frame)) {
      out.profile.frame = data.profile.frame;
    }
  }
  if (Array.isArray(data.unlockedFrames)) {
    out.unlockedFrames = data.unlockedFrames
      .filter(x => typeof x === 'string' && x.length <= 30)
      .slice(0, 50);
  }
  return out;
}

// ─── Инвентарь ───
async function getOwned(env, userId) {
  const rows = await env.DB.prepare(
    'SELECT category, item_id, count FROM inventory WHERE user_id = ?'
  ).bind(userId).all();
  const owned = {};
  for (const cat of Object.keys(CATALOG)) owned[cat] = {};
  for (const row of (rows.results || [])) {
    if (!owned[row.category]) owned[row.category] = {};
    owned[row.category][row.item_id] = row.count;
  }
  return owned;
}

// Открытия за текущий цикл (после последнего ресета категории)
async function getOpenedSinceReset(env, userId) {
  const resetAt = await getResetAt(env, userId);
  const opened = {};
  for (const cat of Object.keys(CATALOG)) {
    const since = resetAt[cat] || 0;
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM opens
       WHERE user_id = ? AND category = ? AND source != 'craft' AND created_at > ?`
    ).bind(userId, cat, since).first();
    opened[cat] = (row && row.cnt) || 0;
  }
  return opened;
}

// Открытия за всё время — нужен для total_opened в users (лидерборд)
async function getOpened(env, userId) {
  const rows = await env.DB.prepare(
    `SELECT category, COUNT(*) as cnt FROM opens
     WHERE user_id = ? AND source != 'craft'
     GROUP BY category`
  ).bind(userId).all();
  const opened = {};
  for (const cat of Object.keys(CATALOG)) opened[cat] = 0;
  for (const row of (rows.results || [])) opened[row.category] = row.cnt;
  return opened;
}

async function getResetAt(env, userId) {
  const row = await env.DB.prepare('SELECT reset_at_json FROM users WHERE id = ?')
    .bind(userId).first();
  let resetAt = {};
  if (row && row.reset_at_json) {
    try { resetAt = JSON.parse(row.reset_at_json); } catch (e) {}
  }
  for (const cat of Object.keys(CATALOG)) {
    if (typeof resetAt[cat] !== 'number') resetAt[cat] = 0;
  }
  return resetAt;
}

async function getResets(env, userId) {
  const row = await env.DB.prepare('SELECT resets_json FROM users WHERE id = ?')
    .bind(userId).first();
  let resets = {};
  if (row && row.resets_json) {
    try { resets = JSON.parse(row.resets_json); } catch (e) {}
  }
  for (const cat of Object.keys(CATALOG)) {
    if (typeof resets[cat] !== 'number') resets[cat] = 0;
  }
  return resets;
}

// ─── Редкость предмета по id ───
function findRarity(category, itemId) {
  const cat = CATALOG[category];
  if (!cat) return null;
  for (const r of Object.keys(cat)) {
    if (cat[r].includes(itemId)) return r;
  }
  return null;
}

// ─── RNG ───
function rollRarity(boostType) {
  const chances = (boostType && BOOST_CHANCES[boostType]) ? BOOST_CHANCES[boostType] : RARITY_CHANCES;
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [r, c] of Object.entries(chances)) {
    acc += c;
    if (roll < acc) return r;
  }
  return 'common';
}

function pickItem(category, rarity) {
  const pool = CATALOG[category] && CATALOG[category][rarity];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Ежедневка ───
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureBag(user) {
  if (!user.daily_bag) {
    const bag = shuffleArray([...Array(DAILY_CYCLE_LENGTH).keys()]);
    return { bag, position: 0 };
  }
  try {
    const bag = JSON.parse(user.daily_bag);
    if (!Array.isArray(bag) || bag.length !== DAILY_CYCLE_LENGTH) {
      return { bag: shuffleArray([...Array(DAILY_CYCLE_LENGTH).keys()]), position: 0 };
    }
    return { bag, position: user.daily_position || 0 };
  } catch (e) {
    return { bag: shuffleArray([...Array(DAILY_CYCLE_LENGTH).keys()]), position: 0 };
  }
}

// ─── Проверка/активация буста ───
async function getActiveBoost(env, userId) {
  const row = await env.DB.prepare(
    'SELECT boost_type, boost_expires_at FROM users WHERE id = ?'
  ).bind(userId).first();
  if (!row || !row.boost_type || !row.boost_expires_at) return null;
  if (row.boost_expires_at <= Date.now()) return null;
  return { type: row.boost_type, expiresAt: row.boost_expires_at };
}

async function activateBoost(env, userId, type) {
  const info = BOOST_INFO[type];
  if (!info) return;
  const expiresAt = Date.now() + info.duration;
  await env.DB.prepare(
    'UPDATE users SET boost_type = ?, boost_expires_at = ? WHERE id = ?'
  ).bind(type, expiresAt, userId).run();
}

// ─── Обновление агрегатов в users ───
async function refreshUserAggregates(env, userId) {
  const openedRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM opens
     WHERE user_id = ? AND source != 'craft'`
  ).bind(userId).first();
  const collectedRow = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM inventory WHERE user_id = ? AND count > 0'
  ).bind(userId).first();
  const resets = await getResets(env, userId);
  const totalResets = Object.values(resets).reduce((s, v) => s + v, 0);
  await env.DB.prepare(
    'UPDATE users SET total_opened = ?, total_collected = ?, total_resets = ? WHERE id = ?'
  ).bind(
    (openedRow && openedRow.cnt) || 0,
    (collectedRow && collectedRow.cnt) || 0,
    totalResets,
    userId
  ).run();
}
// ─── Статистика для достижений ───
async function computeAchievementStats(env, userId) {
  const user = await env.DB.prepare(
    'SELECT coins, shards, total_opened, total_collected, total_resets, daily_streak FROM users WHERE id = ?'
  ).bind(userId).first();

  const invRows = await env.DB.prepare(
    'SELECT category, item_id, count FROM inventory WHERE user_id = ?'
  ).bind(userId).all();

  let legendaryCount = 0, mythicalCount = 0;
  for (const row of (invRows.results || [])) {
    const r = findRarity(row.category, row.item_id);
    if (r === 'legendary') legendaryCount += row.count;
    if (r === 'mythical')  mythicalCount  += row.count;
  }

  const craftRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM opens WHERE user_id = ? AND source = 'craft'`
  ).bind(userId).first();

  return {
    total_opened:    (user && user.total_opened)    || 0,
    total_collected: (user && user.total_collected) || 0,
    total_resets:    (user && user.total_resets)    || 0,
    coins:           (user && user.coins)           || 0,
    shards:          (user && user.shards)          || 0,
    daily_streak:    (user && user.daily_streak)    || 0,
    legendary_count: legendaryCount,
    mythical_count:  mythicalCount,
    craft_count:     (craftRow && craftRow.cnt) || 0,
  };
}

async function getClaimedAchievements(env, userId) {
  const rows = await env.DB.prepare(
    'SELECT achievement_id, claimed_at FROM user_achievements WHERE user_id = ?'
  ).bind(userId).all();
  const claimed = {};
  for (const row of (rows.results || [])) {
    claimed[row.achievement_id] = row.claimed_at;
  }
  return claimed;
}

// ─── Утилиты квестов ───
function getDayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}

function getWeekKey(ts) {
  const d = new Date(ts);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function getStartOfUTCDay(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function getStartOfUTCWeek(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay() || 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 1);
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildQuestState(templates) {
  return templates.map(t => ({ id: t.id, target: t.target, claimed: false }));
}

function findQuestTemplate(kind, id) {
  const pool = kind === 'daily' ? QUEST_POOL_DAILY : QUEST_POOL_WEEKLY;
  return pool.find(q => q.id === id);
}

// Прогресс квеста — считаем по логу opens за период
async function computeQuestProgress(env, userId, type, periodStart) {
  let sql, params;
  switch (type) {
    case 'open':
      sql = `SELECT COUNT(*) as cnt FROM opens
             WHERE user_id = ? AND source IN ('box','buy-box','daily') AND created_at > ?`;
      params = [userId, periodStart];
      break;
    case 'craft':
      sql = `SELECT COUNT(*) as cnt FROM opens
             WHERE user_id = ? AND source = 'craft' AND created_at > ?`;
      params = [userId, periodStart];
      break;
    case 'epic':
      sql = `SELECT COUNT(*) as cnt FROM opens
             WHERE user_id = ? AND rarity = 'epic' AND source IN ('box','buy-box','daily') AND created_at > ?`;
      params = [userId, periodStart];
      break;
    case 'legendary':
      sql = `SELECT COUNT(*) as cnt FROM opens
             WHERE user_id = ? AND rarity = 'legendary' AND source IN ('box','buy-box','daily') AND created_at > ?`;
      params = [userId, periodStart];
      break;
    case 'mythical':
      sql = `SELECT COUNT(*) as cnt FROM opens
             WHERE user_id = ? AND rarity = 'mythical' AND source IN ('box','buy-box','daily') AND created_at > ?`;
      params = [userId, periodStart];
      break;
    default:
      return 0;
  }
  const row = await env.DB.prepare(sql).bind(...params).first();
  return (row && row.cnt) || 0;
}

// Читает quests_json, обновляет если нужны новые daily/weekly
async function ensureQuests(env, userId) {
  const row = await env.DB.prepare('SELECT quests_json FROM users WHERE id = ?')
    .bind(userId).first();

  let data = {};
  if (row && row.quests_json) {
    try { data = JSON.parse(row.quests_json); } catch (e) {}
  }

  const now = Date.now();
  const dayKey = getDayKey(now);
  const weekKey = getWeekKey(now);

  let changed = false;

  if (!data.daily || data.daily.key !== dayKey) {
    data.daily = {
      key: dayKey,
      quests: buildQuestState(pickRandom(QUEST_POOL_DAILY, QUEST_DAILY_COUNT)),
    };
    changed = true;
  }
  if (!data.weekly || data.weekly.key !== weekKey) {
    data.weekly = {
      key: weekKey,
      quests: buildQuestState(pickRandom(QUEST_POOL_WEEKLY, QUEST_WEEKLY_COUNT)),
    };
    changed = true;
  }

  if (changed) {
    await env.DB.prepare('UPDATE users SET quests_json = ? WHERE id = ?')
      .bind(JSON.stringify(data), userId).run();
  }

  return data;
}

// Собирает полный ответ с прогрессом
async function buildQuestsResponse(env, userId) {
  const data = await ensureQuests(env, userId);
  const now = Date.now();
  const dayStart = getStartOfUTCDay(now);
  const weekStart = getStartOfUTCWeek(now);

  const buildOne = async (kind, entry, periodStart) => {
    const out = [];
    for (const q of entry.quests) {
      const tpl = findQuestTemplate(kind, q.id);
      if (!tpl) continue;
      const current = await computeQuestProgress(env, userId, tpl.type, periodStart);
      out.push({
        id: tpl.id,
        icon: tpl.icon,
        name: tpl.name,
        target: q.target,
        current: Math.min(current, q.target),
        done: current >= q.target,
        claimed: !!q.claimed,
        reward: tpl.reward,
      });
    }
    return out;
  };

  return {
    daily: await buildOne('daily', data.daily, dayStart),
    weekly: await buildOne('weekly', data.weekly, weekStart),
    dailyResetAt: dayStart + 24 * 60 * 60 * 1000,
    weeklyResetAt: weekStart + 7 * 24 * 60 * 60 * 1000,
  };
}

// ═══ РОУТЕР ═══
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
      // ═══ РЕГИСТРАЦИЯ ═══
      if (path === '/api/register' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return json({ error: 'Email и пароль обязательны' }, 400, corsHeaders);
        if (String(password).length < 6) return json({ error: 'Пароль должен быть минимум 6 символов' }, 400, corsHeaders);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return json({ error: 'Некорректный email' }, 400, corsHeaders);

        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) return json({ error: 'Пользователь уже существует' }, 409, corsHeaders);

        const hashed = await hashPassword(password);
        await env.DB.prepare('INSERT INTO users (email, password) VALUES (?, ?)').bind(email, hashed).run();
        return json({ message: 'Регистрация успешна' }, 201, corsHeaders);
      }

           // ═══ ВХОД ═══
      if (path === '/api/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return json({ error: 'Email и пароль обязательны' }, 400, corsHeaders);

        const ip = getClientIp(request);
        const emailLower = String(email).toLowerCase();

        // Лимит попыток
        const attempts = await countFailedAttempts(env, ip, emailLower, LOGIN_WINDOW_MS);
        if (attempts.byIp >= LOGIN_MAX_PER_IP) {
          return json({ error: 'Слишком много попыток с этого IP. Попробуй через 15 минут.' }, 429, corsHeaders);
        }
        if (attempts.byEmail >= LOGIN_MAX_PER_EMAIL) {
          return json({ error: 'Слишком много попыток для этого аккаунта. Попробуй через 15 минут.' }, 429, corsHeaders);
        }

        const user = await env.DB.prepare('SELECT id, password FROM users WHERE email = ?').bind(email).first();
        const ok = user && (await verifyPassword(password, user.password));

        await recordLoginAttempt(env, ip, emailLower, !!ok);

        if (!ok) {
          return json({ error: 'Неверный email или пароль' }, 401, corsHeaders);
        }

        const token = generateToken();
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
        ).bind(token, user.id, now, expiresAt).run();
        return json({ token, userId: user.id }, 200, corsHeaders);
      }

      // ═══ ВЫХОД ═══
      if (path === '/api/logout' && method === 'POST') {
        let body = null;
        try { body = await request.json(); } catch (e) {}
        const session = await getSession(request, env, body);
        if (session) {
          await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();
        }
        return json({ message: 'Выход выполнен' }, 200, corsHeaders);
      }

      // ═══ ОТКРЫТИЕ БОКСА ═══
      if (path === '/api/open-box' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const category = String(body.category || '');
        if (!CATALOG[category]) return json({ error: 'Неизвестная категория' }, 400, corsHeaders);

        const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
        const recent = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM opens
           WHERE user_id = ? AND created_at > ? AND source = 'box'`
        ).bind(session.userId, windowStart).first();
        if (recent && recent.cnt >= RATE_LIMIT_MAX_OPENS) {
          return json({ error: 'Слишком быстро, подожди пару секунд' }, 429, corsHeaders);
        }

        const boost = await getActiveBoost(env, session.userId);
        const rarity = rollRarity(boost ? boost.type : null);
        const itemId = pickItem(category, rarity);
        if (!itemId) return json({ error: 'Ошибка каталога' }, 500, corsHeaders);

        const now = Date.now();
        await env.DB.prepare(
          'INSERT INTO opens (user_id, category, item_id, rarity, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(session.userId, category, itemId, rarity, 'box', now).run();

        await env.DB.prepare(
          `INSERT INTO inventory (user_id, category, item_id, count) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, category, item_id) DO UPDATE SET count = count + 1`
        ).bind(session.userId, category, itemId).run();

        await refreshUserAggregates(env, session.userId);

        return json({ itemId, rarity, category }, 200, corsHeaders);
      }

      // ═══ ПОКУПКА ЯЩИКА ═══
      if (path === '/api/buy-box' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const recent = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM opens
           WHERE user_id = ? AND created_at > ?
           AND source IN ('buy-box', 'buy-card')`
        ).bind(session.userId, Date.now() - RATE_LIMIT_WINDOW_MS).first();
        if (recent && recent.cnt >= RATE_LIMIT_MAX_BUYS) {
          return json({ error: 'Слишком быстро' }, 429, corsHeaders);
        }

        const rarity = String(body.rarity || '');
        const currency = String(body.currency || 'coins');
        const category = String(body.category || '');
        if (!CATALOG[category]) return json({ error: 'Неизвестная категория' }, 400, corsHeaders);

        let price;
        if (currency === 'coins') {
          price = BOX_PRICES[rarity];
        } else if (currency === 'shards') {
          price = SHARD_BOX_PRICES[rarity];
        } else {
          return json({ error: 'Неверная валюта' }, 400, corsHeaders);
        }
        if (typeof price !== 'number') return json({ error: 'Неверная редкость' }, 400, corsHeaders);

        const userRow = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();
        const balance = currency === 'coins' ? ((userRow && userRow.coins) || 0) : ((userRow && userRow.shards) || 0);
        if (balance < price) return json({ error: 'Недостаточно средств' }, 400, corsHeaders);

        const itemId = pickItem(category, rarity);
        if (!itemId) return json({ error: 'Ошибка каталога' }, 500, corsHeaders);

        if (currency === 'coins') {
          await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?')
            .bind(price, session.userId).run();
        } else {
          await env.DB.prepare('UPDATE users SET shards = shards - ? WHERE id = ?')
            .bind(price, session.userId).run();
        }

        const now = Date.now();
        await env.DB.prepare(
          'INSERT INTO opens (user_id, category, item_id, rarity, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(session.userId, category, itemId, rarity, 'buy-box', now).run();

        await env.DB.prepare(
          `INSERT INTO inventory (user_id, category, item_id, count) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, category, item_id) DO UPDATE SET count = count + 1`
        ).bind(session.userId, category, itemId).run();

        await refreshUserAggregates(env, session.userId);

        const updated = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          itemId, rarity, category,
          coins: (updated && updated.coins) || 0,
          shards: (updated && updated.shards) || 0,
        }, 200, corsHeaders);
      }

      // ═══ ПОКУПКА КОНКРЕТНОЙ КАРТЫ ═══
      if (path === '/api/buy-card' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const recent = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM opens
           WHERE user_id = ? AND created_at > ?
           AND source IN ('buy-box', 'buy-card')`
        ).bind(session.userId, Date.now() - RATE_LIMIT_WINDOW_MS).first();
        if (recent && recent.cnt >= RATE_LIMIT_MAX_BUYS) {
          return json({ error: 'Слишком быстро' }, 429, corsHeaders);
        }

        const category = String(body.category || '');
        const itemId = String(body.itemId || '');
        if (!CATALOG[category]) return json({ error: 'Неизвестная категория' }, 400, corsHeaders);
        const rarity = findRarity(category, itemId);
        if (!rarity) return json({ error: 'Такого предмета нет' }, 400, corsHeaders);

        const userRow = await env.DB.prepare('SELECT shards FROM users WHERE id = ?')
          .bind(session.userId).first();
        const shards = (userRow && userRow.shards) || 0;
        if (shards < SHARD_CARD_PRICE) return json({ error: 'Недостаточно осколков' }, 400, corsHeaders);

        await env.DB.prepare('UPDATE users SET shards = shards - ? WHERE id = ?')
          .bind(SHARD_CARD_PRICE, session.userId).run();

        const now = Date.now();
        await env.DB.prepare(
          'INSERT INTO opens (user_id, category, item_id, rarity, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(session.userId, category, itemId, rarity, 'buy-card', now).run();

        await env.DB.prepare(
          `INSERT INTO inventory (user_id, category, item_id, count) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, category, item_id) DO UPDATE SET count = count + 1`
        ).bind(session.userId, category, itemId).run();

        await refreshUserAggregates(env, session.userId);

        const updated = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          itemId, rarity, category,
          coins: (updated && updated.coins) || 0,
          shards: (updated && updated.shards) || 0,
        }, 200, corsHeaders);
      }

      // ═══ ПРОДАЖА ДУБЛИКАТОВ ═══
      if (path === '/api/sell' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const rows = await env.DB.prepare(
          'SELECT category, item_id, count FROM inventory WHERE user_id = ? AND count > 1'
        ).bind(session.userId).all();

        const rowResults = rows.results || [];
        let totalGain = 0;
        for (const row of rowResults) {
          const rarity = findRarity(row.category, row.item_id);
          if (!rarity) continue;
          totalGain += (row.count - 1) * (SELL_VALUES[rarity] || 0);
        }

        if (totalGain > 0) {
          const batch = [];
          for (const row of rowResults) {
            batch.push(
              env.DB.prepare(
                `UPDATE inventory SET count = 1
                 WHERE user_id = ? AND category = ? AND item_id = ? AND count > 1`
              ).bind(session.userId, row.category, row.item_id)
            );
          }
          batch.push(
            env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?')
              .bind(totalGain, session.userId)
          );
          await env.DB.batch(batch);
        }

        const userRow = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          gained: totalGain,
          coins: (userRow && userRow.coins) || 0,
          shards: (userRow && userRow.shards) || 0,
        }, 200, corsHeaders);
      }

      // ═══ КРАФТ ═══
      if (path === '/api/craft' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const category = String(body.category || '');
        const fromRarity = String(body.fromRarity || '');
        if (!CATALOG[category]) return json({ error: 'Неизвестная категория' }, 400, corsHeaders);
        const toRarity = CRAFT_UPGRADE[fromRarity];
        if (!toRarity) return json({ error: 'Нельзя плавить эту редкость' }, 400, corsHeaders);

        const rows = await env.DB.prepare(
          'SELECT item_id, count FROM inventory WHERE user_id = ? AND category = ? AND count > 0'
        ).bind(session.userId, category).all();

        const pool = [];
        for (const row of (rows.results || [])) {
          if (findRarity(category, row.item_id) === fromRarity) {
            for (let i = 0; i < row.count; i++) pool.push(row.item_id);
          }
        }
        if (pool.length < CRAFT_AMOUNT) {
          return json({ error: `Нужно ${CRAFT_AMOUNT} предметов редкости "${fromRarity}"` }, 400, corsHeaders);
        }

        const nextPool = CATALOG[category][toRarity] || [];
        if (nextPool.length === 0) return json({ error: 'Нет предметов следующей редкости' }, 500, corsHeaders);

        const toRemove = {};
        for (let i = 0; i < CRAFT_AMOUNT; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const id = pool.splice(idx, 1)[0];
          toRemove[id] = (toRemove[id] || 0) + 1;
        }

        const updates = [];
        for (const id of Object.keys(toRemove)) {
          updates.push(
            env.DB.prepare(
              'UPDATE inventory SET count = count - ? WHERE user_id = ? AND category = ? AND item_id = ?'
            ).bind(toRemove[id], session.userId, category, id)
          );
        }
        updates.push(
          env.DB.prepare(
            'DELETE FROM inventory WHERE user_id = ? AND category = ? AND count <= 0'
          ).bind(session.userId, category)
        );

        const newItemId = nextPool[Math.floor(Math.random() * nextPool.length)];
        updates.push(
          env.DB.prepare(
            `INSERT INTO inventory (user_id, category, item_id, count) VALUES (?, ?, ?, 1)
             ON CONFLICT(user_id, category, item_id) DO UPDATE SET count = count + 1`
          ).bind(session.userId, category, newItemId)
        );

        await env.DB.batch(updates);

        await env.DB.prepare(
          'INSERT INTO opens (user_id, category, item_id, rarity, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(session.userId, category, newItemId, toRarity, 'craft', Date.now()).run();

        await refreshUserAggregates(env, session.userId);

        return json({
          itemId: newItemId,
          rarity: toRarity,
          category,
          owned: await getOwned(env, session.userId),
        }, 200, corsHeaders);
      }

      // ═══ РЕСЕТ ═══
      if (path === '/api/reset' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const category = String(body.category || '');
        if (!CATALOG[category]) return json({ error: 'Неизвестная категория' }, 400, corsHeaders);

        const owned = await getOwned(env, session.userId);
        const opened = await getOpenedSinceReset(env, session.userId); // ← ИСПРАВЛЕНО: за цикл
        const resets = await getResets(env, session.userId);

        const totalItems = Object.values(CATALOG[category]).reduce((s, arr) => s + arr.length, 0);
        const collected = Object.keys(owned[category] || {}).length;
        const requiredOpened = RESET_BASE * (resets[category] + 1);

        if (collected < totalItems) {
          return json({ error: `Не собраны все предметы (${collected}/${totalItems})` }, 400, corsHeaders);
        }
        if (opened[category] < requiredOpened) {
          return json({ error: `Нужно открыть ещё ${requiredOpened - opened[category]} боксов` }, 400, corsHeaders);
        }

        await env.DB.prepare(
          'DELETE FROM inventory WHERE user_id = ? AND category = ?'
        ).bind(session.userId, category).run();

        resets[category] = (resets[category] || 0) + 1;
        const totalResets = Object.values(resets).reduce((s, v) => s + v, 0);

        const resetAt = await getResetAt(env, session.userId);
        resetAt[category] = Date.now();

        await env.DB.prepare(
          'UPDATE users SET resets_json = ?, total_resets = ?, reset_at_json = ? WHERE id = ?'
        ).bind(JSON.stringify(resets), totalResets, JSON.stringify(resetAt), session.userId).run();

        // Серверно выдаём rainbow за 5 ресетов
        if (totalResets >= 5) {
          const fr = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
            .bind(session.userId).first();
          let pdata = {};
          if (fr && fr.data) { try { pdata = JSON.parse(fr.data); } catch (e) {} }
          pdata.unlockedFrames = pdata.unlockedFrames || [];
          if (!pdata.unlockedFrames.includes('rainbow')) pdata.unlockedFrames.push('rainbow');
          await env.DB.prepare(
            'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
          ).bind(session.userId, JSON.stringify(pdata)).run();
        }

        await refreshUserAggregates(env, session.userId);

        return json({
          resets,
          owned: await getOwned(env, session.userId),
          opened: await getOpenedSinceReset(env, session.userId), // ← ИСПРАВЛЕНО: за цикл
        }, 200, corsHeaders);
      }

      // ═══ ЕЖЕДНЕВКА — ИНФО ═══
      if (path === '/api/daily-info' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const user = await env.DB.prepare(
          'SELECT daily_last_claim, daily_streak, daily_bag, daily_position FROM users WHERE id = ?'
        ).bind(session.userId).first();

        const { bag, position } = ensureBag(user || {});
        const lastClaim = (user && user.daily_last_claim) || null;
        const streak = (user && user.daily_streak) || 0;

        let canClaim = true;
        if (lastClaim && Date.now() - lastClaim < DAILY_COOLDOWN) canClaim = false;

        return json({
          lastClaim,
          streak,
          position,
          bag,
          canClaim,
        }, 200, corsHeaders);
      }

      // ═══ ЕЖЕДНЕВКА — ЗАБРАТЬ ═══
      if (path === '/api/daily' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const user = await env.DB.prepare(
          'SELECT daily_last_claim, daily_streak, daily_bag, daily_position, coins, shards FROM users WHERE id = ?'
        ).bind(session.userId).first();

        if (user && user.daily_last_claim && Date.now() - user.daily_last_claim < DAILY_COOLDOWN) {
          return json({ error: 'Награда ещё не готова' }, 400, corsHeaders);
        }

        const { bag, position } = ensureBag(user || {});
        const rewardIdx = bag[position];
        const reward = DAILY_REWARDS[rewardIdx];
        if (!reward) return json({ error: 'Ошибка награды' }, 500, corsHeaders);

        let newStreak = 1;
        if (user && user.daily_last_claim && (Date.now() - user.daily_last_claim) <= DAILY_STREAK_RESET) {
          newStreak = (user.daily_streak || 0) + 1;
        }

        let coinGain = 0;
        let shardGain = 0;
        let rewardItem = null;
        let boostActivated = null;

        switch (reward.type) {
          case 'coins':
            coinGain = reward.amount; break;
          case 'shards':
            shardGain = reward.amount; break;
          case 'coins_shards':
            coinGain = reward.coins; shardGain = reward.shards; break;
          case 'box': {
            const itemId = pickItem('elements', reward.boxRarity) || pickItem('gems', reward.boxRarity) || pickItem('equipment', reward.boxRarity);
            if (itemId) {
              const rarity = reward.boxRarity;
              let cat = 'elements';
              if (CATALOG.gems[rarity] && CATALOG.gems[rarity].includes(itemId)) cat = 'gems';
              else if (CATALOG.equipment[rarity] && CATALOG.equipment[rarity].includes(itemId)) cat = 'equipment';
              await env.DB.prepare(
                'INSERT INTO opens (user_id, category, item_id, rarity, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
              ).bind(session.userId, cat, itemId, rarity, 'daily', Date.now()).run();
              await env.DB.prepare(
                `INSERT INTO inventory (user_id, category, item_id, count) VALUES (?, ?, ?, 1)
                 ON CONFLICT(user_id, category, item_id) DO UPDATE SET count = count + 1`
              ).bind(session.userId, cat, itemId).run();
              rewardItem = { itemId, rarity, category: cat };
            }
            break;
          }
          case 'boost':
            await activateBoost(env, session.userId, reward.boostType);
            boostActivated = reward.boostType;
            break;
        }

        let newPosition = position + 1;
        let newBag = bag;
        if (newPosition >= DAILY_CYCLE_LENGTH) {
          newBag = shuffleArray([...Array(DAILY_CYCLE_LENGTH).keys()]);
          newPosition = 0;
        }

        const now = Date.now();
        await env.DB.prepare(
          `UPDATE users SET
             daily_last_claim = ?,
             daily_streak = ?,
             daily_bag = ?,
             daily_position = ?,
             coins = coins + ?,
             shards = shards + ?
           WHERE id = ?`
        ).bind(
          now, newStreak,
          JSON.stringify(newBag), newPosition,
          coinGain, shardGain,
          session.userId
        ).run();

        await refreshUserAggregates(env, session.userId);

        if (newStreak >= 7 || newStreak >= 30) {
          const fr = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
            .bind(session.userId).first();
          let pdata = {};
          if (fr && fr.data) { try { pdata = JSON.parse(fr.data); } catch (e) {} }
          pdata.unlockedFrames = pdata.unlockedFrames || [];
          if (newStreak >= 7 && !pdata.unlockedFrames.includes('silver')) pdata.unlockedFrames.push('silver');
          if (newStreak >= 30 && !pdata.unlockedFrames.includes('gold')) pdata.unlockedFrames.push('gold');
          await env.DB.prepare(
            'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
          ).bind(session.userId, JSON.stringify(pdata)).run();
        }

        const updated = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          reward,
          streak: newStreak,
          position: newPosition,
          bag: newBag,
          lastClaim: now,
          coinGain,
          shardGain,
          coins: (updated && updated.coins) || 0,
          shards: (updated && updated.shards) || 0,
          rewardItem,
          boostActivated,
        }, 200, corsHeaders);
      }

      // ═══ СОХРАНЕНИЕ ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const clean = sanitizeClientFields(body.progressData);
        if (!clean) return json({ error: 'Некорректный progressData' }, 400, corsHeaders);

        const userRow = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?')
          .bind(session.userId).first();
        if (userRow && userRow.nickname) clean.profile.nickname = userRow.nickname;

        await env.DB.prepare(
          'UPDATE users SET avatar = ?, frame = ? WHERE id = ?'
        ).bind(
          clean.profile.avatar || '🐱',
          clean.profile.frame || 'default',
          session.userId
        ).run();

        const row = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
          .bind(session.userId).first();
        let existingData = {};
        if (row && row.data) {
          try { existingData = JSON.parse(row.data); } catch (e) {}
        }
        await env.DB.prepare(
          'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(session.userId, JSON.stringify(existingData)).run();

        return json({ message: 'Прогресс сохранён' }, 200, corsHeaders);
      }

      // ═══ ЗАГРУЗКА ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'GET') {
        const session = await getSession(request, env, null);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const owned = await getOwned(env, session.userId);
        const opened = await getOpenedSinceReset(env, session.userId); // ← ИСПРАВЛЕНО: за цикл
        const resets = await getResets(env, session.userId);

        const userRow = await env.DB.prepare(
          'SELECT nickname, avatar, frame, coins, shards, total_opened, boost_type, boost_expires_at, daily_last_claim, daily_streak, daily_bag, daily_position FROM users WHERE id = ?'
        ).bind(session.userId).first();

        const progressRow = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
          .bind(session.userId).first();
        let progressData = {};
        if (progressRow && progressRow.data) {
          try { progressData = JSON.parse(progressRow.data); } catch (e) {}
        }

        let dailyBag = null;
        if (userRow && userRow.daily_bag) {
          try { dailyBag = JSON.parse(userRow.daily_bag); } catch (e) { dailyBag = null; }
        }

        const state = {
          coins: (userRow && userRow.coins) || 0,
          shards: (userRow && userRow.shards) || 0,
          profile: {
            avatar: (userRow && userRow.avatar) || '🐱',
            frame: (userRow && userRow.frame) || 'default',
            nickname: (userRow && userRow.nickname) || '',
          },
          boost: (userRow && userRow.boost_type && userRow.boost_expires_at > Date.now())
            ? { type: userRow.boost_type, expiresAt: userRow.boost_expires_at }
            : null,
          daily: {
            lastClaim: (userRow && userRow.daily_last_claim) || null,
            streak: (userRow && userRow.daily_streak) || 0,
            bag: dailyBag,
            position: (userRow && userRow.daily_position) || 0,
          },
          unlockedFrames: progressData.unlockedFrames || [],
          owned,
          opened,                                         // ← за цикл
          openedTotal: (userRow && userRow.total_opened) || 0, // ← за всё время
          resets,
        };

        return json(state, 200, corsHeaders);
      }

      // ═══ УСТАНОВКА НИКА ═══
      if (path === '/api/set-nickname' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const nickname = String(body.nickname || '').trim();
        if (nickname.length < 3) return json({ error: 'Минимум 3 символа' }, 400, corsHeaders);
        if (nickname.length > 20) return json({ error: 'Максимум 20 символов' }, 400, corsHeaders);
        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) return json({ error: 'Только латиница, цифры и _' }, 400, corsHeaders);

        const taken = await env.DB.prepare(
          'SELECT id FROM users WHERE LOWER(nickname) = LOWER(?) AND id != ?'
        ).bind(nickname, session.userId).first();
        if (taken) return json({ error: 'Этот ник уже занят' }, 409, corsHeaders);

        await env.DB.prepare('UPDATE users SET nickname = ? WHERE id = ?')
          .bind(nickname, session.userId).run();
        return json({ message: 'Ник сохранён', nickname }, 200, corsHeaders);
      }

      // ═══ СТАТИСТИКА ДРОПА ═══
      if (path === '/api/stats/drops' && method === 'GET') {
        const now = Date.now();
        const day24 = now - 24 * 60 * 60 * 1000;
        const days14 = now - 14 * 24 * 60 * 60 * 1000;

        const overall = await env.DB.prepare(
          `SELECT rarity, COUNT(*) as cnt FROM opens
           WHERE source IN ('box', 'buy-box')
           GROUP BY rarity`
        ).all();

        const last24h = await env.DB.prepare(
          `SELECT rarity, COUNT(*) as cnt FROM opens
           WHERE source IN ('box', 'buy-box') AND created_at > ?
           GROUP BY rarity`
        ).bind(day24).all();

        const daily = await env.DB.prepare(
          `SELECT
             date(created_at / 1000, 'unixepoch') as day,
             rarity,
             COUNT(*) as cnt
           FROM opens
           WHERE source IN ('box', 'buy-box') AND created_at > ?
           GROUP BY day, rarity
           ORDER BY day ASC`
        ).bind(days14).all();

        const totalRow = await env.DB.prepare(
          `SELECT COUNT(*) as total FROM opens WHERE source IN ('box', 'buy-box')`
        ).first();

        return json({
          overall: overall.results || [],
          last24h: last24h.results || [],
          daily: daily.results || [],
          total: (totalRow && totalRow.total) || 0,
          generatedAt: now,
        }, 200, corsHeaders);
      }

      // ═══ ЛИДЕРБОРД ═══
      if (path === '/api/leaderboard' && method === 'GET') {
        // Считаем total_opened на лету — не полагаемся на users.total_opened,
        // который может быть 0 у старых аккаунтов.
        const result = await env.DB.prepare(
          `SELECT
             u.nickname, u.avatar, u.frame, u.total_resets,
             (SELECT COUNT(*) FROM opens
                WHERE opens.user_id = u.id AND source != 'craft') as total_opened,
             (SELECT COUNT(*) FROM inventory
                WHERE inventory.user_id = u.id AND count > 0) as total_collected
           FROM users u
           WHERE u.nickname IS NOT NULL AND u.nickname != ''
           ORDER BY u.total_resets DESC, total_collected DESC, total_opened DESC
           LIMIT 50`
        ).all();
        return json({ leaders: result.results || [] }, 200, corsHeaders);
      }
      // ═══ ДОСТИЖЕНИЯ — СПИСОК ═══
      if (path === '/api/achievements' && method === 'GET') {
        const session = await getSession(request, env, null);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const stats = await computeAchievementStats(env, session.userId);
        const claimed = await getClaimedAchievements(env, session.userId);

        const list = ACHIEVEMENTS.map(a => {
          const current = stats[a.stat] || 0;
          const done = current >= a.target;
          return {
            id: a.id,
            icon: a.icon,
            name: a.name,
            desc: a.desc,
            target: a.target,
            current: Math.min(current, a.target),
            done,
            claimed: !!claimed[a.id],
            reward: a.reward,
          };
        });

        return json({ achievements: list, stats }, 200, corsHeaders);
      }

      // ═══ ДОСТИЖЕНИЯ — ЗАБРАТЬ НАГРАДУ ═══
      if (path === '/api/achievements/claim' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const achId = String(body.id || '');
        const ach = ACHIEVEMENTS.find(a => a.id === achId);
        if (!ach) return json({ error: 'Неизвестное достижение' }, 400, corsHeaders);

        // Уже получено?
        const existing = await env.DB.prepare(
          'SELECT claimed_at FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
        ).bind(session.userId, achId).first();
        if (existing) return json({ error: 'Уже получено' }, 400, corsHeaders);

        // Проверяем, что цель достигнута
        const stats = await computeAchievementStats(env, session.userId);
        const current = stats[ach.stat] || 0;
        if (current < ach.target) {
          return json({ error: 'Условие ещё не выполнено' }, 400, corsHeaders);
        }

        // Начисляем награду + записываем факт получения
        const coinGain = ach.reward.coins || 0;
        const shardGain = ach.reward.shards || 0;
        const now = Date.now();

        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO user_achievements (user_id, achievement_id, claimed_at) VALUES (?, ?, ?)'
          ).bind(session.userId, achId, now),
          env.DB.prepare(
            'UPDATE users SET coins = coins + ?, shards = shards + ? WHERE id = ?'
          ).bind(coinGain, shardGain, session.userId),
        ]);

        const updated = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          id: achId,
          coinGain,
          shardGain,
          coins:  (updated && updated.coins)  || 0,
          shards: (updated && updated.shards) || 0,
        }, 200, corsHeaders);
      }
      
      // ═══ КВЕСТЫ — СПИСОК ═══
      if (path === '/api/quests' && method === 'GET') {
        const session = await getSession(request, env, null);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const result = await buildQuestsResponse(env, session.userId);
        return json(result, 200, corsHeaders);
      }

      // ═══ КВЕСТЫ — ЗАБРАТЬ НАГРАДУ ═══
      if (path === '/api/quests/claim' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const kind = String(body.kind || ''); // 'daily' | 'weekly'
        const questId = String(body.id || '');
        if (kind !== 'daily' && kind !== 'weekly') {
          return json({ error: 'Неверный тип квеста' }, 400, corsHeaders);
        }
        const tpl = findQuestTemplate(kind, questId);
        if (!tpl) return json({ error: 'Неизвестный квест' }, 400, corsHeaders);

        const data = await ensureQuests(env, session.userId);
        const bucket = data[kind];
        const q = bucket.quests.find(x => x.id === questId);
        if (!q) return json({ error: 'Квест не найден' }, 400, corsHeaders);
        if (q.claimed) return json({ error: 'Уже получено' }, 400, corsHeaders);

        const now = Date.now();
        const periodStart = kind === 'daily' ? getStartOfUTCDay(now) : getStartOfUTCWeek(now);
        const current = await computeQuestProgress(env, session.userId, tpl.type, periodStart);
        if (current < q.target) {
          return json({ error: 'Условие ещё не выполнено' }, 400, corsHeaders);
        }

        q.claimed = true;
        const coinGain = tpl.reward.coins || 0;
        const shardGain = tpl.reward.shards || 0;

        await env.DB.batch([
          env.DB.prepare('UPDATE users SET quests_json = ? WHERE id = ?')
            .bind(JSON.stringify(data), session.userId),
          env.DB.prepare('UPDATE users SET coins = coins + ?, shards = shards + ? WHERE id = ?')
            .bind(coinGain, shardGain, session.userId),
        ]);

        const updated = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          id: questId,
          kind,
          coinGain,
          shardGain,
          coins: (updated && updated.coins) || 0,
          shards: (updated && updated.shards) || 0,
        }, 200, corsHeaders);
      }
      
      // ═══ ПРОВЕРКА СЕРВЕРА ═══
      if (path === '/api/ping') {
        return json({ status: 'ok', time: new Date().toISOString() }, 200, corsHeaders);
      }

      return json({ error: 'Not found' }, 404, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}