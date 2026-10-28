-- Decks a student names themselves, and folders to keep them in.
--
-- A card belongs to at most one deck. Cards in no deck are grouped by
-- subject, as they always were. Deleting a folder leaves its decks loose;
-- deleting a deck deletes its cards (the app asks first).

BEGIN;

CREATE TABLE IF NOT EXISTS flashcard_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES flashcard_folders(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flashcard_folders_user ON flashcard_folders (user_id);
CREATE INDEX IF NOT EXISTS flashcard_decks_user ON flashcard_decks (user_id);

ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES flashcard_decks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS flashcards_deck ON flashcards (deck_id) WHERE deck_id IS NOT NULL;

ALTER TABLE flashcard_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own folders" ON flashcard_folders;
CREATE POLICY "Students manage own folders" ON flashcard_folders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- A deck may only sit in the student's own folder.
DROP POLICY IF EXISTS "Students manage own decks" ON flashcard_decks;
CREATE POLICY "Students manage own decks" ON flashcard_decks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (folder_id IS NULL OR EXISTS (SELECT 1 FROM flashcard_folders f WHERE f.id = folder_id AND f.user_id = auth.uid()))
  );

-- A card may only go in the student's own deck.
DROP POLICY IF EXISTS "Students create own cards" ON flashcards;
CREATE POLICY "Students create own cards" ON flashcards
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (deck_id IS NULL OR EXISTS (SELECT 1 FROM flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()))
  );
DROP POLICY IF EXISTS "Students update own cards" ON flashcards;
CREATE POLICY "Students update own cards" ON flashcards
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (deck_id IS NULL OR EXISTS (SELECT 1 FROM flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()))
  );

COMMIT;
