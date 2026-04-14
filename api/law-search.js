export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OC = process.env.LAW_OC;
  if (!OC) {
    return res.status(500).json({ error: 'LAW_OC not configured' });
  }

  try {
    const { query, target = 'law', display = '5' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(OC)}&target=${encodeURIComponent(target)}&type=JSON&query=${encodeURIComponent(query)}&display=${encodeURIComponent(display)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message, cause: err.cause ? String(err.cause) : null, stack: err.stack });
  }
}
