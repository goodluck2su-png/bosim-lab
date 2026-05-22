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

    // Step 2: target=law 는 efYd를 무시하고 항상 현행을 반환하므로, 과거(처분시점)는
    // 시행일법령(target=eflaw)+efYd로 조회한다. eflaw 식별자(ID/LM/MST)를 순차 시도해
    // 통하는 방식을 자동 선택한다(진단용 tried 포함).
    const efYd = baseDate ? String(baseDate).replace(/[^0-9]/g, '') : '';

    const build = (params) => {
      const u = new URLSearchParams({ OC, type: 'JSON', ...params });
      return 'http://www.law.go.kr/DRF/lawService.do?' + u.toString();
    };
    const redact = (u) => u.replace(/OC=[^&]*/, 'OC=***');
    const findEnf = (o) => {
      if (!o || typeof o !== 'object') return undefined;
      if (o.기본정보 && o.기본정보.시행일자) return o.기본정보.시행일자;
      for (const k of Object.keys(o)) {
        const r = findEnf(o[k]);
        if (r) return r;
      }
      return undefined;
    };

    const currentUrl = build({ target: 'law', ID: lawId });
    const currentRes = await fetch(currentUrl);
    const currentData = currentRes.ok ? await currentRes.json() : { error: '현행 법령 조회 실패' };

    let past = null;
    let pastStrategy = 'law(현행)';
    const tried = [];
    if (efYd) {
      const candidates = [
        ['eflaw+ID+efYd', build({ target: 'eflaw', ID: lawId, efYd })],
        ['eflaw+LM+efYd', build({ target: 'eflaw', LM: lawName, efYd })],
        ['eflaw+MST+efYd', build({ target: 'eflaw', MST: mst, efYd })],
      ];
      for (const [strat, url] of candidates) {
        try {
          const r = await fetch(url);
          const d = r.ok ? await r.json() : { error: 'HTTP ' + r.status };
          const enf = findEnf(d);
          tried.push({ strat, ok: r.ok, 시행일자: enf || null, note: enf ? null : JSON.stringify(d).slice(0, 80) });
          if (enf) { past = d; pastStrategy = strat; break; }
        } catch (e) {
          tried.push({ strat, error: e.message });
        }
      }
    }
    if (!past) {
      past = efYd ? { error: '처분시점 법령 조회 실패', tried } : currentData;
    }

    return res.status(200).json({
      lawId,
      mst,
      lawName,
      baseDate: efYd || '현행',
      pastStrategy,
      tried,
      currentUrl: redact(currentUrl),
      past,
      current: currentData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
