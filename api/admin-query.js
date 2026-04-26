// Whitelisted tables, ops, and column name pattern (security-hardened)
const ALLOWED_TABLES = ['chat_logs', 'reflections', 'cases'];
const ALLOWED_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'];
const COLUMN_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_,*\s().]*$/;

const ALLOWED_ORIGINS = [
  'https://bosim-lab.vercel.app',
  'http://localhost:3000'
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, table, select, order, limit, filters } = req.body || {};

  // 1. Password check (env var, not hardcoded)
  const ADMIN_PW = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PW) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }
  if (password !== ADMIN_PW) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Table whitelist
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid table' });
  }

  // 3. select column validation
  const safeSelect = select || '*';
  if (!COLUMN_PATTERN.test(safeSelect)) {
    return res.status(400).json({ error: 'Invalid select pattern' });
  }

  // 4. limit validation (number, max 1000)
  const safeLimit = limit ? Math.min(parseInt(limit, 10) || 100, 1000) : null;

  // 5. order validation (column.direction)
  let safeOrder = null;
  if (order) {
    const orderMatch = String(order).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.(asc|desc)$/);
    if (!orderMatch) {
      return res.status(400).json({ error: 'Invalid order format' });
    }
    safeOrder = orderMatch[0];
  }

  // 6. filter validation
  const safeFilters = [];
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (!f || typeof f !== 'object') continue;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.column)) {
        return res.status(400).json({ error: 'Invalid filter column' });
      }
      if (!ALLOWED_OPS.includes(f.op)) {
        return res.status(400).json({ error: 'Invalid filter op' });
      }
      safeFilters.push(f);
    }
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = 'https://dorocsjhtamcjxwhlqbl.supabase.co';
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Service key not configured' });
  }

  try {
    let queryParams = `select=${encodeURIComponent(safeSelect)}`;
    if (safeOrder) queryParams += `&order=${encodeURIComponent(safeOrder)}`;
    if (safeLimit) queryParams += `&limit=${safeLimit}`;
    safeFilters.forEach(f => {
      queryParams += `&${encodeURIComponent(f.column)}=${encodeURIComponent(f.op)}.${encodeURIComponent(f.value)}`;
    });

    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
    const response = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Query failed', detail: errText, url });
    }

    const data = await response.json();
    const count = response.headers.get('content-range');
    const total = count ? parseInt(count.split('/')[1]) : data.length;
    return res.status(200).json({ data, total });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: err.message, stack: err.stack });
  }
}
