/*
  # PM Office Sessions Tracking

  1. New Tables
    - `pm_office_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `started_at` (timestamptz) - When the session started
      - `ended_at` (timestamptz, nullable) - When the session ended (null if active)
      - `duration_seconds` (integer) - Total duration in seconds
      - `notes` (text, nullable) - Optional notes about tasks performed
      - `is_paused` (boolean) - Whether the session is currently paused
      - `paused_at` (timestamptz, nullable) - When the session was paused
      - `total_paused_seconds` (integer) - Total time paused in seconds
      - `created_at` (timestamptz) - Record creation time

  2. Changes to Existing Tables
    - Add `pm_office_time` column to `route_history` table to track PM Office time per route

  3. Security
    - Enable RLS on `pm_office_sessions` table
    - Add policies for authenticated users to manage their own sessions
    - Users can only view and modify their own PM Office sessions

  4. Indexes
    - Add index on `user_id` and `started_at` for efficient queries
    - Add index on `user_id` and `ended_at` for filtering active sessions
*/

-- Create pm_office_sessions table
CREATE TABLE IF NOT EXISTS pm_office_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  notes text,
  is_paused boolean DEFAULT false,
  paused_at timestamptz,
  total_paused_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add pm_office_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'pm_office_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN pm_office_time integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE pm_office_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for pm_office_sessions
CREATE POLICY "Users can view own PM Office sessions"
  ON pm_office_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PM Office sessions"
  ON pm_office_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PM Office sessions"
  ON pm_office_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own PM Office sessions"
  ON pm_office_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pm_office_sessions_user_started 
  ON pm_office_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pm_office_sessions_user_ended 
  ON pm_office_sessions(user_id, ended_at DESC);