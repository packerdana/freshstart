/*
  # Create waypoints table

  1. New Tables
    - `waypoints`
      - `id` (uuid, primary key)
      - `route_id` (uuid, foreign key to routes)
      - `date` (date, the work day this waypoint belongs to)
      - `address` (text, delivery address)
      - `delivery_time` (timestamptz, when the delivery was made)
      - `packages` (integer, number of packages delivered, default 0)
      - `status` (text, completed/pending/skipped, default 'pending')
      - `sequence_number` (integer, order in route)
      - `notes` (text, optional notes)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on waypoints table
    - Users can only access waypoints for their own routes
    - Authenticated users can create, read, update, and delete their own waypoints

  3. Indexes
    - Index on waypoints(route_id, date) for fast daily lookups
    - Index on waypoints(route_id, date, sequence_number) for ordered retrieval
*/

-- Create waypoints table
CREATE TABLE IF NOT EXISTS waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  address text NOT NULL,
  delivery_time timestamptz,
  packages integer DEFAULT 0,
  status text DEFAULT 'pending',
  sequence_number integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waypoints_route_date ON waypoints(route_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_waypoints_route_date_sequence ON waypoints(route_id, date DESC, sequence_number);

-- Enable RLS
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;

-- Waypoints policies
CREATE POLICY "Users can view own waypoints"
  ON waypoints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoints.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own waypoints"
  ON waypoints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoints.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own waypoints"
  ON waypoints FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoints.route_id
      AND routes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoints.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own waypoints"
  ON waypoints FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoints.route_id
      AND routes.user_id = auth.uid()
    )
  );