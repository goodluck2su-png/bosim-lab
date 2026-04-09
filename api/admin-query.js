export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, table, select, order, limit, filters } = req.body;

  // Password check
  if (password !== 'bosim2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = 'https://dorocsjhtamcjxwhlqbl.supabase.co';

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Service key not configured' });
  }

  try {
    // Build query params
    let queryParams = `select=${encodeURIComponent(select || '*')}`;
    if (order) queryParams += `&order=${encodeURIComponent(order)}`;
    if (limit) queryParams += `&limit=${limit}`;

    const headers = {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact'
    };

    // Add filters as query params
    let filterStr = '';
    if (filters) {
      filters.forEach(f => {
        filterStr += `&${f.column}=${f.op}.${f.value}`;
      });
    }

    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}${filterStr}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return res.status(response.status).json({ error: await response.text() });
    }

    const data = await response.json();
    const count = response.headers.get('content-range');
    const total = count ? parseInt(count.split('/')[1]) : data.length;

    return res.status(200).json({ data, total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
