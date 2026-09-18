// ═══════════════════════════════════════════════
//  BOXES BACKEND — сервер для аккаунтов
// ═══════════════════════════════════════════════

// Хеширование пароля через PBKDF2 (встроено в Web Crypto)
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
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);
  return `PBKDF2-SHA256$60000$${btoa(String.fromCharCode(...saltArray))}$${btoa(String.fromCharCode(...hashArray))}`;
}

// Проверка пароля
async function verifyPassword(password, storedHash) {
  const parts = storedHash.split('$');
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
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const newHash = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return newHash === originalHash;
}

function generateToken() {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}

// CORS — разрешаем запросы с доменов Cloudflare Pages
const ALLOWED_ORIGINS = [
  'https://mybox-game.pages.dev',
  'https://myfootball-1od.pages.dev',
];

function getCorsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

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
        if (!email || !password) {
          return json({ error: 'Email и пароль обязательны' }, 400, corsHeaders);
        }
        if (password.length < 6) {
          return json({ error: 'Пароль должен быть минимум 6 символов' }, 400, corsHeaders);
        }

        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) {
          return json({ error: 'Пользователь уже существует' }, 409, corsHeaders);
        }

        const hashedPassword = await hashPassword(password);
        await env.DB.prepare('INSERT INTO users (email, password) VALUES (?, ?)').bind(email, hashedPassword).run();

        return json({ message: 'Регистрация успешна' }, 201, corsHeaders);
      }

      // ═══ ВХОД ═══
      if (path === '/api/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) {
          return json({ error: 'Email и пароль обязательны' }, 400, corsHeaders);
        }

        const user = await env.DB.prepare('SELECT id, password FROM users WHERE email = ?').bind(email).first();
        if (!user || !(await verifyPassword(password, user.password))) {
          return json({ error: 'Неверный email или пароль' }, 401, corsHeaders);
        }

        const token = generateToken();
        return json({ token, userId: user.id }, 200, corsHeaders);
      }

      // ═══ СОХРАНЕНИЕ ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'POST') {
        const { userId, progressData } = await request.json();
        if (!userId || progressData === undefined) {
          return json({ error: 'Неверные данные' }, 400, corsHeaders);
        }

        const dataString = JSON.stringify(progressData);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(userId, dataString).run();

        return json({ message: 'Прогресс сохранён' }, 200, corsHeaders);
      }

      // ═══ ЗАГРУЗКА ПРОГРЕССА ═══
      if (path === '/api/progress' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return json({ error: 'Не указан userId' }, 400, corsHeaders);
        }

        const row = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?').bind(userId).first();
        if (row) {
          return new Response(row.data, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return json({}, 200, corsHeaders);
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
