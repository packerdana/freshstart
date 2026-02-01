/*
  # Create Loading History Table

  1. New Tables
    - `loading_history`
      - `id` (uuid, primary key) - Unique identifier for each loading entry
      - `user_id` (uuid, foreign key) - Reference to the user who performed the loading
      - `package_count` (integer) - Number of packages loaded
      - `loading_time` (integer) - Time taken to load in milliseconds
      - `created_at` (timestamptz) - Timestamp when the loading occurred
      
  2. Security
    - Enable RLS on `loading_history` table
    - Add policy for authenticated users to read their own loading history
    - Add policy for authenticated users to insert their own loading history
    - Add policy for authenticated users to delete their own loading history

  3. Indexes
    - Index on `user_id` for faster queries
    - Index on `package_count` for range queries
    - Composite index on `user_id` and `created_at` for efficient history retrieval
*/

CREATE TABLE IF NOT EXISTS loading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  package_count integer NOT NULL CHECK (package_count > 0),
  loading_time integer NOT NULL CHECK (loading_time > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE loading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own loading history"
  ON loading_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loading history"
  ON loading_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own loading history"
  ON loading_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_loading_history_user_id 
  ON loading_history(user_id);

CREATE INDEX IF NOT EXISTS idx_loading_history_package_count 
  ON loading_history(package_count);

CREATE INDEX IF NOT EXISTS idx_loading_history_user_created 
  ON loading_history(user_id, created_at DESC);
