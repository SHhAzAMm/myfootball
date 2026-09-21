// ═══════════════════════════════════════════════
//  BOXES BACKEND — v3
//  + серверный RNG открытий
//  + инвентарь в БД
//  + серверные ресеты
//  + rate limit на open-box
//  + ленивая миграция старых игроков
// ═══════════════════════════════════════════════

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MAX_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const RESET_BASE = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX_OPENS = 30;

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
const SELL_VALUES = {
  common: 1, rare: 5, epic: 20, legendary: 100, mythical: 500,
};

const RARITY_CHANCES = { common: 50, rare: 25, epic: 15, legendary: 8, mythical: 2 };
const BOOST_CHANCES = {
  rare: { common: 35, rare: 40, epic: 15, legendary: 8, mythical: 2 },
  epic: { common: 40, rare: 23, epic: 22, legendary: 12, mythical: 3 },
};

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

function sanitizeClientFields(data) {
  if (!data || typeof data !== 'object') return null;

  const num = (v, min = 0) => {
    if (typeof v !== 'number' || !isFinite(v) || v < min) return null;
    return Math.floor(v);
  };

  const out = {
    coins: 0,
    shards: 0,
    profile: { avatar: '🐱', frame: 'default', nickname: '' },
    boost: null,
    daily: null,
    unlockedFrames: [],
  };

  const c = num(data.coins); if (c !== null) out.coins = c;
  const s = num(data.shards); if (s !== null) out.shards = s;

  if (data.profile && typeof data.profile === 'object') {
    if (typeof data.profile.avatar === 'string' && data.profile.avatar.length <= 8) {
      out.profile.avatar = data.profile.avatar;
    }
    if (typeof data.profile.frame === 'string' && /^[a-z]{1,20}$/.test(data.profile.frame)) {
      out.profile.frame = data.profile.frame;
    }
  }

  if (data.boost && typeof data.boost === 'object') {
    const exp = num(data.boost.expiresAt);
    if (exp !== null && typeof data.boost.type === 'string' && data.boost.type.length <= 20) {
      out.boost = { type: data.boost.type, expiresAt: exp };
    }
  }

  if (data.daily && typeof data.daily === 'object') {
    const d = data.daily;
    const lastClaim = (typeof d.lastClaim === 'number' && isFinite(d.lastClaim))
      ? Math.floor(d.lastClaim) : null;
    const streak = num(d.streak);
    const position = num(d.position);
    const bag = Array.isArray(d.bag)
      ? d.bag.filter(x => Number.isInteger(x) && x >= 0 && x < 1000).slice(0, 100)
      : [];
    out.daily = {
      lastClaim,
      streak: streak === null ? 0 : streak,
      position: position === null ? 0 : position,
      bag,
    };
  }

  if (Array.isArray(data.unlockedFrames)) {
    out.unlockedFrames = data.unlockedFrames
      .filter(x => typeof x === 'string' && x.length <= 30)
      .slice(0, 50);
  }

  return out;
}

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

async function getOpened(env, userId) {
  const rows = await env.DB.prepare(
    'SELECT category, COUNT(*) as cnt FROM opens WHERE user_id = ? GROUP BY category'
  ).bind(userId).all();
  const opened = {};
  for (const cat of Object.keys(CATALOG)) opened[cat] = 0;
  for (const row of (rows.results || [])) opened[row.category] = row.cnt;
  return opened;
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

async function ensureMigrated(env, userId) {
  // Миграция отключена — старые данные недоверенные, не переносим.
}

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
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

      if (path === '/api/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return json({ error: 'Email и пароль обязательны' }, 400, corsHeaders);
        const user = await env.DB.prepare('SELECT id, password FROM users WHERE email = ?').bind(email).first();
        if (!user || !(await verifyPassword(password, user.password))) {
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

      if (path === '/api/logout' && method === 'POST') {
        let body = null;
        try { body = await request.json(); } catch (e) {}
        const session = await getSession(request, env, body);
        if (session) {
          await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();
        }
        return json({ message: 'Выход выполнен' }, 200, corsHeaders);
      }

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
          'SELECT COUNT(*) as cnt FROM opens WHERE user_id = ? AND created_at > ?'
        ).bind(session.userId, windowStart).first();
        if (recent && recent.cnt >= RATE_LIMIT_MAX_OPENS) {
          return json({ error: 'Слишком быстро, подожди пару секунд' }, 429, corsHeaders);
        }

        const progressRow = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
          .bind(session.userId).first();
        let boostType = null;
        if (progressRow) {
          try {
            const d = JSON.parse(progressRow.data);
            if (d.boost && d.boost.expiresAt > Date.now()) boostType = d.boost.type;
          } catch (e) {}
        }

        const rarity = rollRarity(boostType);
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

        const openedRow = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM opens WHERE user_id = ?'
        ).bind(session.userId).first();
        const collectedRow = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM inventory WHERE user_id = ? AND count > 0'
        ).bind(session.userId).first();
        await env.DB.prepare(
          'UPDATE users SET total_opened = ?, total_collected = ? WHERE id = ?'
        ).bind(openedRow.cnt, collectedRow.cnt, session.userId).run();

        return json({ itemId, rarity, category }, 200, corsHeaders);
      }
      // ═══ ПРОДАЖА ДУБЛИКАТОВ ═══
      if (path === '/api/sell' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        // Читаем инвентарь — все категории сразу
        const rows = await env.DB.prepare(
          'SELECT category, item_id, count FROM inventory WHERE user_id = ? AND count > 1'
        ).bind(session.userId).all();

        let totalGain = 0;
        const updates = [];

        for (const row of (rows.results || [])) {
          const cat = row.category;
          const itemId = row.item_id;
          const count = row.count;

          // Ищем редкость предмета в CATALOG
          let rarity = null;
          const catCatalog = CATALOG[cat];
          if (!catCatalog) continue;
          for (const r of Object.keys(catCatalog)) {
            if (catCatalog[r].includes(itemId)) { rarity = r; break; }
          }
          if (!rarity) continue;

          const dupes = count - 1;
          const value = dupes * (SELL_VALUES[rarity] || 0);
          totalGain += value;

          updates.push(
            env.DB.prepare(
              'UPDATE inventory SET count = 1 WHERE user_id = ? AND category = ? AND item_id = ?'
            ).bind(session.userId, cat, itemId)
          );
        }

        if (totalGain > 0) {
          await env.DB.batch(updates);
        }

        // Начисляем монеты
        await env.DB.prepare(
          'UPDATE users SET coins = coins + ? WHERE id = ?'
        ).bind(totalGain, session.userId).run();

        const userRow = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        return json({
          gained: totalGain,
          coins: (userRow && userRow.coins) || 0,
          shards: (userRow && userRow.shards) || 0,
        }, 200, corsHeaders);
      }

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
        const opened = await getOpened(env, session.userId);
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
        await env.DB.prepare(
          'UPDATE users SET resets_json = ?, total_resets = ? WHERE id = ?'
        ).bind(JSON.stringify(resets), totalResets, session.userId).run();

        const collectedRow = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM inventory WHERE user_id = ? AND count > 0'
        ).bind(session.userId).first();
        await env.DB.prepare(
          'UPDATE users SET total_collected = ? WHERE id = ?'
        ).bind(collectedRow.cnt, session.userId).run();

        return json({
          resets,
          owned: await getOwned(env, session.userId),
          opened: await getOpened(env, session.userId),
        }, 200, corsHeaders);
      }

      if (path === '/api/progress' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const clean = sanitizeClientFields(body.progressData);
        if (!clean) return json({ error: 'Некорректный progressData' }, 400, corsHeaders);

        const owned = await getOwned(env, session.userId);
        const opened = await getOpened(env, session.userId);
        const resets = await getResets(env, session.userId);

        const userRow = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?')
          .bind(session.userId).first();
        if (userRow && userRow.nickname) clean.profile.nickname = userRow.nickname;

        // Монеты/осколки берём из БД, не из клиента!
        const userRow2 = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        const serverState = {
          coins: (userRow2 && userRow2.coins) || 0,
          shards: (userRow2 && userRow2.shards) || 0,
          profile: clean.profile,
          boost: clean.boost,
          daily: clean.daily,
          unlockedFrames: clean.unlockedFrames,
          owned,
          opened,
          resets,
        };

        const dataString = JSON.stringify(serverState);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(session.userId, dataString).run();

        const totalOpened = Object.values(opened).reduce((s, v) => s + v, 0);
        const totalCollected = Object.values(owned).reduce((s, obj) => s + Object.keys(obj).length, 0);
        const totalResets = Object.values(resets).reduce((s, v) => s + v, 0);
        await env.DB.prepare(
          'UPDATE users SET total_opened = ?, total_collected = ?, total_resets = ?, avatar = ?, frame = ? WHERE id = ?'
        ).bind(
          totalOpened, totalCollected, totalResets,
          clean.profile.avatar || '🐱', clean.profile.frame || 'default',
          session.userId
        ).run();

        return json({ message: 'Прогресс сохранён', state: serverState }, 200, corsHeaders);
      }

      if (path === '/api/progress' && method === 'GET') {
        const session = await getSession(request, env, null);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        await ensureMigrated(env, session.userId);

        const row = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?')
          .bind(session.userId).first();
        const userRow = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?')
          .bind(session.userId).first();

        let data = {};
        if (row) {
          try { data = JSON.parse(row.data); } catch (e) { data = {}; }
        }

        const owned = await getOwned(env, session.userId);
        const opened = await getOpened(env, session.userId);
        const resets = await getResets(env, session.userId);

        const userRowCoins = await env.DB.prepare('SELECT coins, shards FROM users WHERE id = ?')
          .bind(session.userId).first();

        const state = {
          coins: (userRowCoins && userRowCoins.coins) || 0,
          shards: (userRowCoins && userRowCoins.shards) || 0,
          profile: data.profile || { avatar: '🐱', frame: 'default', nickname: '' },
          boost: data.boost || null,
          daily: data.daily || null,
          unlockedFrames: data.unlockedFrames || [],
          owned,
          opened,
          resets,
        };

        if (userRow && userRow.nickname) state.profile.nickname = userRow.nickname;

        return json(state, 200, corsHeaders);
      }

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

      if (path === '/api/leaderboard' && method === 'GET') {
        const result = await env.DB.prepare(
          `SELECT nickname, avatar, frame, total_opened, total_collected, total_resets
           FROM users
           WHERE nickname IS NOT NULL AND nickname != ''
           ORDER BY total_resets DESC, total_collected DESC, total_opened DESC
           LIMIT 50`
        ).all();
        return json({ leaders: result.results || [] }, 200, corsHeaders);
      }

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