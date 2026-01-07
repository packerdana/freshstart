/*
  # Create Waypoint Templates Table

  1. New Tables
    - `waypoint_templates`
      - `id` (uuid, primary key)
      - `route_id` (uuid, foreign key to routes)
      - `name` (text, waypoint name/address)
      - `sequence_number` (integer, order in route)
      - `notes` (text, optional notes)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Purpose
    - Store master waypoint templates for each route
    - Templates auto-populate waypoints each day
    - Users can save their standard route stops once and reuse daily

  3. Security
    - Enable RLS on waypoint_templates table
    - Users can only access templates for their own routes
    - Authenticated users can create, read, update, and delete their own templates

  4. Indexes
    - Index on waypoint_templates(route_id) for fast lookups
    - Index on waypoint_templates(route_id, sequence_number) for ordered retrieval
*/

-- Create waypoint_templates table
CREATE TABLE IF NOT EXISTS waypoint_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sequence_number integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waypoint_templates_route ON waypoint_templates(route_id);
CREATE INDEX IF NOT EXISTS idx_waypoint_templates_route_sequence ON waypoint_templates(route_id, sequence_number);

-- Enable RLS
ALTER TABLE waypoint_templates ENABLE ROW LEVEL SECURITY;

-- Templates policies
CREATE POLICY "Users can view own waypoint templates"
  ON waypoint_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoint_templates.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own waypoint templates"
  ON waypoint_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoint_templates.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own waypoint templates"
  ON waypoint_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoint_templates.route_id
      AND routes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoint_templates.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own waypoint templates"
  ON waypoint_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = waypoint_templates.route_id
      AND routes.user_id = auth.uid()
    )
  );