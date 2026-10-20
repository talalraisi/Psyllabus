-- CAS is gone from the app. It is pass or fail with nothing to quiz, revise
-- or mark, so it only ever sat in lists doing nothing. Taken out of every
-- profile's subject list and out of the syllabus. Anything filed under it
-- (there is nothing: it never had questions) goes with it.
--
-- Run as a direct connection, which the subject-list guard trusts.

BEGIN;

UPDATE profiles
   SET subjects = (
     SELECT coalesce(jsonb_agg(s), '[]'::jsonb)
       FROM jsonb_array_elements_text(subjects) s
      WHERE s NOT IN ('Creativity Activity Service', 'Creativity, Activity, Service', 'Creativity, Activity, Service (CAS)', 'CAS')
   )
 WHERE subjects ?| ARRAY['Creativity Activity Service', 'Creativity, Activity, Service', 'Creativity, Activity, Service (CAS)', 'CAS'];

UPDATE profiles SET free_subject = NULL WHERE free_subject IN ('Creativity Activity Service', 'Creativity, Activity, Service', 'CAS');

DELETE FROM syllabus_content WHERE subject IN ('Creativity Activity Service', 'Creativity, Activity, Service', 'Creativity, Activity, Service (CAS)');

COMMIT;
