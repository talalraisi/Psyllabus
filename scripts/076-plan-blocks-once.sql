-- Each study block once.
--
-- The study plan rewrites a student's blocks by deleting from today and
-- inserting again. Two of those running at once (two tabs, or a page that
-- mounts twice) both deleted before either inserted, and every block landed
-- twice: the calendar showed each one side by side with its copy. The
-- copies go, and the database now refuses a second identical block, which
-- the plan's write ignores rather than fails on.

BEGIN;

DELETE FROM plan_blocks a
 USING plan_blocks b
 WHERE a.user_id = b.user_id
   AND a.starts_at = b.starts_at
   AND a.ends_at = b.ends_at
   AND a.title IS NOT DISTINCT FROM b.title
   AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS plan_blocks_once
  ON plan_blocks (user_id, starts_at, ends_at, title);

COMMIT;
