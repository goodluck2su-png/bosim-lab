const ALLOWED_ORIGINS = [
  'https://bosim-lab.vercel.app',
  'http://localhost:3000'
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const OC = process.env.LAW_OC;
  if (!OC) return res.status(500).json({ error: 'LAW_OC not configured' });

  try {
    const { lawName, baseDate } = req.query;
    if (!lawName) return res.status(400).json({ error: 'lawName is required' });

    // Step 1: 법령명으로 검색 → MST 취득
    const searchUrl = `http://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(OC)}&target=law&type=JSON&query=${encodeURIComponent(lawName)}&display=1`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return res.status(500).json({ error: '법령 검색 실패' });

    const searchData = await searchRes.json();
    const laws = searchData?.LawSearch?.law;
    if (!laws || laws.length === 0) {
      return res.status(404).json({ error: '해당 법령을 찾을 수 없습니다', searchResult: searchData });
    }
    const mst = Array.isArray(laws) ? laws[0]['법령일련번호'] : laws['법령일련번호'];

    // Step 2: MST로 처분시점 법령 + 현행 법령 동시 조회
    const baseDateParam = baseDate ? `&efYd=${encodeURIComponent(baseDate)}` : '';
    const pastUrl = `http://www.law.go.kr/DRF/lawService.do?OC=${encodeURIComponent(OC)}&target=law&type=JSON&MST=${encodeURIComponent(mst)}${baseDateParam}`;
    const currentUrl = `http://www.law.go.kr/DRF/lawService.do?OC=${encodeURIComponent(OC)}&target=law&type=JSON&MST=${encodeURIComponent(mst)}`;

    const [pastRes, currentRes] = await Promise.all([
      fetch(pastUrl),
      fetch(currentUrl)
    ]);

    const pastData = pastRes.ok ? await pastRes.json() : { error: '처분시점 법령 조회 실패' };
    const currentData = currentRes.ok ? await currentRes.json() : { error: '현행 법령 조회 실패' };

    return res.status(200).json({
      mst,
      lawName,
      baseDate: baseDate || '현행',
      pastUrl,
      currentUrl,
      past: pastData,
      current: currentData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
