-- PSyllabus MVP schema: progress tracking + syllabus content

CREATE TABLE IF NOT EXISTS syllabus_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  curriculum text NOT NULL DEFAULT 'IB',
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,
  hl_only boolean DEFAULT false,
  UNIQUE (curriculum, subject, subtopic)
);

CREATE TABLE IF NOT EXISTS progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,
  status text DEFAULT 'not_started',
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, subject, subtopic)
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own progress" ON progress;
CREATE POLICY "Users manage own progress" ON progress
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Syllabus content is public read for authenticated users
ALTER TABLE syllabus_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read syllabus content" ON syllabus_content;
CREATE POLICY "Anyone can read syllabus content" ON syllabus_content
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_syllabus_content_subject ON syllabus_content (subject);
CREATE INDEX IF NOT EXISTS idx_progress_user_subject ON progress (user_id, subject);
