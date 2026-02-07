/*
  # Assistant (chat + NALC docs) tables

  1) assistant_threads
     - per-user threads

  2) assistant_messages
     - per-thread messages (user/assistant)

  3) nalc_sources / nalc_chunks
     - document sources and chunked text for retrieval (RAG)
     - No RLS policies are added for these tables (not accessible from client by default)
*/

-- Threads
CREATE TABLE IF NOT EXISTS assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-fill user_id + keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_assistant_thread_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistant_threads_defaults ON assistant_threads;
CREATE TRIGGER trg_assistant_threads_defaults
BEFORE INSERT ON assistant_threads
FOR EACH ROW
EXECUTE FUNCTION public.set_assistant_thread_defaults();

CREATE OR REPLACE FUNCTION public.touch_assistant_threads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE assistant_threads
     SET updated_at = now()
   WHERE id = COALESCE(NEW.thread_id, OLD.thread_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_assistant_threads_user_updated ON assistant_threads(user_id, updated_at DESC);

ALTER TABLE assistant_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assistant threads"
  ON assistant_threads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own assistant threads"
  ON assistant_threads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own assistant threads"
  ON assistant_threads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own assistant threads"
  ON assistant_threads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Messages
CREATE TABLE IF NOT EXISTS assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  citations jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread_created ON assistant_messages(thread_id, created_at ASC);

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assistant messages"
  ON assistant_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assistant_threads t
      WHERE t.id = assistant_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own assistant messages"
  ON assistant_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assistant_threads t
      WHERE t.id = assistant_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own assistant messages"
  ON assistant_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assistant_threads t
      WHERE t.id = assistant_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

-- Touch thread.updated_at whenever messages change
DROP TRIGGER IF EXISTS trg_assistant_messages_touch_thread ON assistant_messages;
CREATE TRIGGER trg_assistant_messages_touch_thread
AFTER INSERT OR UPDATE OR DELETE ON assistant_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_assistant_threads_updated_at();

-- NALC sources/chunks (ingested by admin tools / edge functions)
CREATE TABLE IF NOT EXISTS nalc_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nalc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES nalc_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nalc_chunks_source_chunk ON nalc_chunks(source_id, chunk_index);
