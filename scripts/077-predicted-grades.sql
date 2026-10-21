-- The grade a student is predicted now, per subject, beside the target they
-- set. Optional: plenty of students have no prediction yet. Kept small.

BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS predicted_grades jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_predicted_grades_shape;
ALTER TABLE profiles ADD CONSTRAINT profiles_predicted_grades_shape
  CHECK (jsonb_typeof(predicted_grades) = 'object' AND pg_column_size(predicted_grades) <= 4096);
COMMIT;
