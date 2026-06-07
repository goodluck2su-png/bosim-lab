-- 1. 대화 로그 테이블
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nickname TEXT NOT NULL,
  session_id TEXT,
  practice_step INTEGER,
  user_prompt TEXT,
  ai_response TEXT,
  response_time_ms INTEGER
);

-- 2. 소감 테이블
CREATE TABLE IF NOT EXISTS reflections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nickname TEXT NOT NULL,
  practice_step INTEGER,
  reflection_text TEXT
);

-- 3. 페이지뷰 테이블 (방문자 추적)
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  is_new_session BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- 4. RLS 활성화
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 5. anon 키 INSERT만 허용
CREATE POLICY "insert_only" ON chat_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "insert_only" ON reflections FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "insert_only" ON page_views FOR INSERT TO anon WITH CHECK (true);
