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

-- 3. RLS 활성화
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

-- 4. anon 키 INSERT만 허용
CREATE POLICY "insert_only" ON chat_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "insert_only" ON reflections FOR INSERT TO anon WITH CHECK (true);
