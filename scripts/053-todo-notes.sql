-- A to-do can have more to it than a title.
--
-- "Finish the bibliography" is the task; "Chicago style, supervisor wants it
-- by Thursday, three sources still missing" is the part you will have
-- forgotten by Thursday. It was going in the title, which made the list
-- unreadable, or nowhere, which made the list useless.

BEGIN;

ALTER TABLE todos ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN todos.note IS 'Free text detail shown when the row is opened.';

COMMIT;
