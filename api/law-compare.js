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

    const build = (path, params) =>
      `http://www.law.go.kr/DRF/${path}?` + new URLSearchParams({ OC, type: 'JSON', ...params }).toString();
    const redact = (u) => u.replace(/OC=[^&]*/, 'OC=***');
    const efYd = baseDate ? String(baseDate).replace(/[^0-9]/g, '') : '';

    // Step 0: 현행법령 검색 → 법령ID / 정식 법령명 확보
    const searchRes = await fetch(build('lawSearch.do', { target: 'law', query: lawName, display: '1' }));
    if (!searchRes.ok) return res.status(502).json({ error: '법령 검색 실패' });
    const searchData = await searchRes.json();
    let laws = searchData?.LawSearch?.law;
    if (!laws) return res.status(404).json({ error: '해당 법령을 찾을 수 없습니다', searchResult: searchData });
    const lawObj = Array.isArray(laws) ? laws[0] : laws;
    const lawId = lawObj['법령ID'];
    const officialName = lawObj['법령명한글'] || lawName;
    if (!lawId) return res.status(500).json({ error: '법령ID를 찾을 수 없습니다', lawObj });

    // 현행 본문 (target=law 는 efYd를 무시하고 항상 현행을 반환)
    const currentUrl = build('lawService.do', { target: 'law', ID: lawId });

    // 처분시점 본문: Step1 시행일법령 버전 목록 → Step2 처분일 이하 최신 버전 선택 → Step3 본문 조회
    // efYd 단독으로는 "정확히 그 날짜가 시행일인 버전"만 반환되므로, 버전 목록에서
    // 처분일에 실제 시행 중이던 버전(시행일자 ≤ 처분일 중 최신)을 찾아 조회해야 한다.
    let pastUrl = null;
    let selectedEf = null;
    let versionsFound = 0;
    let pastNote = null;

    if (efYd) {
      // Step 1: 시행일법령(target=eflaw) 버전 목록 (>100 버전 대비 페이지네이션)
      const seen = new Set();
      const versions = [];
      for (let page = 1; page <= 10; page++) {
        const listRes = await fetch(build('lawSearch.do', { target: 'eflaw', query: officialName, display: '100', page: String(page) }));
        if (!listRes.ok) break;
        let vlist = (await listRes.json())?.LawSearch?.law || [];
        if (!Array.isArray(vlist)) vlist = [vlist];
        if (vlist.length === 0) break;
        for (const v of vlist) {
          if (!v || v['법령ID'] !== lawId || !v['시행일자']) continue;
          const key = v['시행일자'] + '_' + v['법령일련번호'];
          if (seen.has(key)) continue;
          seen.add(key);
          versions.push({ ef: String(v['시행일자']), mst: String(v['법령일련번호']) });
        }
        if (vlist.length < 100) break;
      }
      versions.sort((a, b) => a.ef.localeCompare(b.ef));
      versionsFound = versions.length;

      // Step 2: 처분일 이하 중 가장 최근 시행일자 (처분 당시 시행 중이던 버전)
      const eligible = versions.filter((v) => v.ef <= efYd);
      if (eligible.length) {
        const sel = eligible[eligible.length - 1];
        selectedEf = sel.ef;
        // Step 3: 해당 버전 본문 (eflaw + MST + 그 버전의 정확한 시행일자)
        pastUrl = build('lawService.do', { target: 'eflaw', MST: sel.mst, efYd: sel.ef });
      } else {
        pastNote = `처분일(${efYd}) 이전에 시행된 법령 버전을 찾지 못했습니다`;
      }
    } else {
      // 처분일 미입력 → 현행과 동일
      pastUrl = currentUrl;
      selectedEf = '현행';
    }

    const [pastRes, currentRes] = await Promise.all([
      pastUrl ? fetch(pastUrl) : Promise.resolve(null),
      fetch(currentUrl)
    ]);
    const pastData = pastUrl
      ? (pastRes.ok ? await pastRes.json() : { error: '처분시점 법령 조회 실패' })
      : { error: pastNote || '처분시점 법령 조회 실패' };
    const currentData = currentRes.ok ? await currentRes.json() : { error: '현행 법령 조회 실패' };

    return res.status(200).json({
      lawId,
      lawName: officialName,
      baseDate: efYd || '현행',
      selectedEnforceDate: selectedEf,
      versionsFound,
      pastUrl: pastUrl ? redact(pastUrl) : null,
      currentUrl: redact(currentUrl),
      past: pastData,
      current: currentData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
