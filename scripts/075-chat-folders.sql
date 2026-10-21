-- Folders for Syllabi chats.
--
-- A student's own folders, named by them, and a chat can sit in one. Deleting
-- a folder keeps its chats (they go back to the main list), and nobody can
-- put a chat in someone else's folder: the folder has to be theirs too.

BEGIN;

CREATE TABLE IF NOT EXISTS syllabi_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_syllabi_folders_user ON syllabi_folders (user_id, created_at);

ALTER TABLE syllabi_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own folders" ON syllabi_folders;
CREATE POLICY "Own folders" ON syllabi_folders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON syllabi_folders FROM anon;

DROP TRIGGER IF EXISTS syllabi_folders_row_cap ON syllabi_folders;
CREATE TRIGGER syllabi_folders_row_cap BEFORE INSERT ON syllabi_folders
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('50');

ALTER TABLE syllabi_chats ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES syllabi_folders(id) ON DELETE SET NULL;

-- A chat may only go in a folder of its own owner.
CREATE OR REPLACE FUNCTION syllabi_chat_folder_is_own() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM syllabi_folders f WHERE f.id = NEW.folder_id AND f.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'That folder is not yours.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS syllabi_chats_folder_own ON syllabi_chats;
CREATE TRIGGER syllabi_chats_folder_own BEFORE INSERT OR UPDATE OF folder_id ON syllabi_chats
  FOR EACH ROW EXECUTE FUNCTION syllabi_chat_folder_is_own();

COMMIT;
