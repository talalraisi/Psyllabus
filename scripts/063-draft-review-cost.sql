-- The draft review now returns marks per criterion and highlights as JSON,
-- with room for up to 6,000 tokens of output (thinking included). With up to
-- ~30k tokens of draft in, the most one review can cost on Sonnet 5.5 is
-- about $0.12, so that is what a claim reserves.

BEGIN;
UPDATE ai_limits SET worst_cost_micro = 130000 WHERE task = 'draft_feedback';
COMMIT;
