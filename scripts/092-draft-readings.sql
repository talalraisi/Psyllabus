-- A draft is now marked three times for its marks (lib/draft-marking.js):
-- the full review and two short marks-only readings. Reserve for them too.
UPDATE ai_limits SET worst_cost_micro = 480000 WHERE task = 'draft_feedback';
