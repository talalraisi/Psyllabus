-- Draft reviews are now much fuller (an overview, an examiner's comment,
-- section by section feedback and up to twenty pinned comments), with room
-- for up to 12,000 tokens of output. With up to ~30k tokens of draft in, the
-- most one can cost on Sonnet 5.5 is about $0.18, so that is what a claim
-- reserves. It is settled at what it really cost as soon as it finishes.

BEGIN;
UPDATE ai_limits SET worst_cost_micro = 190000 WHERE task = 'draft_feedback';
COMMIT;
