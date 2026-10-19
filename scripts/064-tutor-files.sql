-- Tutor messages that carry files or links get their own, smaller allowance.
--
-- A plain question costs at most about $0.002. One with up to three photos,
-- twenty PDF pages and two linked pages can read ~85k tokens on Haiku 5.5:
-- about $0.01. Counting those against the plain allowance would let forty a
-- day each cost five times as much; this keeps the two apart.

BEGIN;
INSERT INTO ai_limits (task, per_day, per_minute, worst_cost_micro) VALUES
  ('tutor_files', 10, 3, 12000)
ON CONFLICT (task) DO NOTHING;
COMMIT;
