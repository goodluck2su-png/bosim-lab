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
    const lawObj = Array.isArray(laws) ? laws[0] : laws;
    const mst = lawObj['법령일련번호'];
    const lawId = lawObj['법령ID'];
    if (!lawId) {
      return res.status(500).json({ error: '법령ID를 찾을 수 없습니다', lawObj });
    }

    // Step 2: 현행은 target=law(ID), 처분시점은 시행일법령(target=eflaw)+법령명(LM)+efYd로 조회.
    // target=law 는 efYd를 무시하고 항상 현행을 반환하므로 과거 조회에는 eflaw를 써야 하며,
    // eflaw는 LM(법령명)+efYd 조합에서만 해당 시점 버전을 반환한다(ID/MST는 동작하지 않음).
    const efYd = baseDate ? String(baseDate).replace(/[^0-9]/g, '') : '';
    const officialName = lawObj['법령명한글'] || lawName;

    const build = (params) => 'http://www.law.go.kr/DRF/lawService.do?' + new URLSearchParams({ OC, type: 'JSON', ...params }).toString();
    const redact = (u) => u.replace(/OC=[^&]*/, 'OC=***');

    const currentUrl = build({ target: 'law', ID: lawId });
    const pastUrl = efYd ? build({ target: 'eflaw', LM: officialName, efYd }) : currentUrl;

    const [pastRes, currentRes] = await Promise.all([
      fetch(pastUrl),
      fetch(currentUrl)
    ]);

    const pastData = pastRes.ok ? await pastRes.json() : { error: '처분시점 법령 조회 실패' };
    const currentData = currentRes.ok ? await currentRes.json() : { error: '현행 법령 조회 실패' };

    return res.status(200).json({
      lawId,
      mst,
      lawName: officialName,
      baseDate: efYd || '현행',
      pastTarget: efYd ? 'eflaw(LM)' : 'law',
      pastUrl: redact(pastUrl),
      currentUrl: redact(currentUrl),
      past: pastData,
      current: currentData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
