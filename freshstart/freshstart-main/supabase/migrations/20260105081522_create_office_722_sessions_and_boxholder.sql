/*
  # Office 722 Timer & Boxholder Tracking

  1. New Tables
    - `office_722_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `route_id` (uuid, foreign key to routes)
      - `started_at` (timestamptz) - When the 722 session started
      - `ended_at` (timestamptz, nullable) - When the session ended (null if active)
      - `duration_seconds` (integer) - Total duration in seconds
      - `auto_started` (boolean) - Whether timer started automatically
      - `is_paused` (boolean) - Whether the session is currently paused
      - `paused_at` (timestamptz, nullable) - When the session was paused
      - `total_paused_seconds` (integer) - Total time paused in seconds
      - `created_at` (timestamptz) - Record creation time

  2. Changes to Existing Tables
    - Add `office_722_time` column to `route_history` table (actual 722 time in minutes)
    - Add `has_boxholder` column to `route_history` table (tracks EDDM/Boxholder mail)
    - Add `auto_start_722_timer` column to `routes` table (user preference)

  3. Security
    - Enable RLS on `office_722_sessions` table
    - Add policies for authenticated users to manage their own sessions
    - Users can only view and modify their own 722 sessions

  4. Indexes
    - Add index on `user_id` and `started_at` for efficient queries
    - Add index on `route_id` and `started_at` for route-specific queries
*/

-- Create office_722_sessions table
CREATE TABLE IF NOT EXISTS office_722_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  auto_started boolean DEFAULT false,
  is_paused boolean DEFAULT false,
  paused_at timestamptz,
  total_paused_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add office_722_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'office_722_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN office_722_time integer DEFAULT 0;
  END IF;
END $$;

-- Add has_boxholder to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'has_boxholder'
  ) THEN
    ALTER TABLE route_history ADD COLUMN has_boxholder boolean DEFAULT false;
  END IF;
END $$;

-- Add auto_start_722_timer preference to routes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routes' AND column_name = 'auto_start_722_timer'
  ) THEN
    ALTER TABLE routes ADD COLUMN auto_start_722_timer boolean DEFAULT true;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE office_722_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for office_722_sessions
CREATE POLICY "Users can view own 722 sessions"
  ON office_722_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 722 sessions"
  ON office_722_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 722 sessions"
  ON office_722_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own 722 sessions"
  ON office_722_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_office_722_sessions_user_started 
  ON office_722_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_office_722_sessions_route_started 
  ON office_722_sessions(route_id, started_at DESC);