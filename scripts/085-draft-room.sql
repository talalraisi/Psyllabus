-- A draft review's room to write now grows with the draft (app/api/syllabi,
-- up to 32,000 tokens): an Extended Essay ran out at 12,000 and came back
-- unfinished, costing the student a review for nothing.
--
-- Sonnet 5.5 reading up to ~30k tokens ($0.06) and writing up to 32,000
-- ($0.32): about $0.38 at worst; reserved at $0.40, so the claim stays a
-- ceiling. A short draft still costs what it uses.

BEGIN;

UPDATE ai_limits SET worst_cost_micro = 400000 WHERE task = 'draft_feedback';

COMMIT;
