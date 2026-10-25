-- Syllabi reads a draft's PDF itself (app/api/syllabi/read): equations,
-- diagrams and quotations pasted in as pictures come through, where pulling
-- the text out in the browser lost them.
--
-- Haiku 5.5 reading at most 40 pages (about 3,000 tokens a page with its
-- images, so 120,000 in) and writing at most 16,000 tokens: about $0.02 at
-- worst; reserved at $0.03. Six a day, as a PDF is read once per draft.

BEGIN;

INSERT INTO ai_limits (task, per_day, per_minute, worst_cost_micro) VALUES
  ('read_pdf', 6, 3, 30000)
ON CONFLICT (task) DO NOTHING;

COMMIT;
