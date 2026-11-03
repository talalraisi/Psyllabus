-- The IB exam session a student sits: May or November, and the year
-- (M27, N27, M28, N28, ...). grad_year stays the year, for everything that
-- reads it; the session says whether the exams are in May or November.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS exam_session text CHECK (exam_session IS NULL OR exam_session ~ '^[MN][0-9]{2}$');
