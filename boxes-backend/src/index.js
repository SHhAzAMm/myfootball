// ═══════════════════════════════════════════════
//  BOXES BACKEND — v2
//  + сессии (sliding + cap 90 дней)
//  + токен-авторизация на защищённых эндпоинтах
//  + валидация progressData
//  + лидерборд
// ═══════════════════════════════════════════════

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;              // 30 дней
const SESSION_MAX_MS = 90 * 24 * 60 * 60 * 1000;              // потолок 90 дней
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;     // продлеваем не чаще раза в сутки

// ─── Пароли ───
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 60000, hash: 'SHA-256' },
    keyMaterial,
    256
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
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const newHash = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return newHash === originalHash;
}

function generateToken() {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
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
    'Access-Control-Max-Age': '86400',
  };
}

// ─── Сессии ───
async function getSession(request, env, bodyOrNull) {
  let token = null;
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();

  // Фолбэк на тело запроса — для sendBeacon (он не умеет слать заголовки)
  if (!token && bodyOrNull && typeof bodyOrNull.token === 'string') {
    token = bodyOrNull.token;
  }
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
  // Жёсткий потолок 90 дней от создания
  if (now - row.created_at > SESSION_MAX_MS) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  // Sliding refresh — не чаще раза в сутки
  if (row.expires_at - now < SESSION_TTL_MS - SESSION_REFRESH_THRESHOLD_MS) {
    const newExpiry = now + SESSION_TTL_MS;
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .bind(newExpiry, token).run();
  }

  return { userId: row.user_id, token };
}

// ─── Санитайзер прогресса ───
function sanitizeProgress(data) {
  if (!data || typeof data !== 'object') return null;

  const out = {
    opened: {},
    owned: {},
    resets: {},
    coins: 0,
    shards: 0,
    profile: { avatar: '🐱', frame: 'default', nickname: '' },
    boost: null,
    daily: null,
    unlockedFrames: [],
  };

  const num = (v, min = 0) => {
    if (typeof v !== 'number' || !isFinite(v) || v < min) return null;
    return Math.floor(v);
  };

  const c = num(data.coins); if (c !== null) out.coins = c;
  const s = num(data.shards); if (s !== null) out.shards = s;

  if (data.opened && typeof data.opened === 'object') {
    for (const k of Object.keys(data.opened)) {
      const v = num(data.opened[k]);
      if (v !== null) out.opened[k] = v;
    }
  }
  if (data.resets && typeof data.resets === 'object') {
    for (const k of Object.keys(data.resets)) {
      const v = num(data.resets[k]);
      if (v !== null) out.resets[k] = v;
    }
  }
  if (data.owned && typeof data.owned === 'object') {
    for (const cat of Object.keys(data.owned)) {
      const src = data.owned[cat];
      if (!src || typeof src !== 'object') continue;
      out.owned[cat] = {};
      for (const id of Object.keys(src)) {
        const v = num(src[id], 1);
        if (v !== null) out.owned[cat][id] = v;
      }
    }
  }

  if (data.profile && typeof data.profile === 'object') {
    if (typeof data.profile.avatar === 'string' && data.profile.avatar.length <= 8) {
      out.profile.avatar = data.profile.avatar;
    }
    if (typeof data.profile.frame === 'string' && /^[a-z]{1,20}$/.test(data.profile.frame)) {
      out.profile.frame = data.profile.frame;
    }
    // nickname НЕ берём — только через /api/set-nickname
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

// ─── Роутер ───
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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

      // ═══ СОХРАНЕНИЕ ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) {
          return json({ error: 'Некорректный JSON' }, 400, corsHeaders);
        }
        const session = await getSession(request, env, body);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const clean = sanitizeProgress(body.progressData);
        if (!clean) return json({ error: 'Некорректный progressData' }, 400, corsHeaders);

        const dataString = JSON.stringify(clean);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(session.userId, dataString).run();

        // Агрегаты + профиль для лидерборда
        const totalOpened = Object.values(clean.opened).reduce((s, v) => s + (v || 0), 0);
        const totalCollected = Object.values(clean.owned).reduce((s, obj) => s + Object.keys(obj).length, 0);
        const totalResets = Object.values(clean.resets).reduce((s, v) => s + (v || 0), 0);
        await env.DB.prepare(
          'UPDATE users SET total_opened = ?, total_collected = ?, total_resets = ?, avatar = ?, frame = ? WHERE id = ?'
      ).bind(
         totalOpened,
         totalCollected,
         totalResets,
         clean.profile.avatar || '🐱',
         clean.profile.frame || 'default',
         session.userId
      ).run();

        return json({ message: 'Прогресс сохранён' }, 200, corsHeaders);
      }

      // ═══ ЗАГРУЗКА ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'GET') {
        const session = await getSession(request, env, null);
        if (!session) return json({ error: 'Не авторизован' }, 401, corsHeaders);

        const row = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?').bind(session.userId).first();
        const user = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?').bind(session.userId).first();

        let data = {};
        if (row) {
          try { data = JSON.parse(row.data); } catch (e) { data = {}; }
        }
        if (!data.profile) data.profile = { avatar: '🐱', frame: 'default', nickname: '' };
        if (user && user.nickname) data.profile.nickname = user.nickname;

        return json(data, 200, corsHeaders);
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

      // ═══ ЛИДЕРБОРД ═══
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