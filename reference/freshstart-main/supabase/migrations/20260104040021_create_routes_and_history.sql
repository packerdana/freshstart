/*
  # RouteWise Database Schema

  1. New Tables
    - `routes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `route_number` (text, route identifier)
      - `start_time` (text, format HH:MM)
      - `tour_length` (numeric, hours)
      - `lunch_duration` (integer, minutes, default 30)
      - `comfort_stop_duration` (integer, minutes, default 10)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `route_history`
      - `id` (uuid, primary key)
      - `route_id` (uuid, foreign key to routes)
      - `date` (date, the work day)
      - `dps` (integer, DPS mail volume, default 0)
      - `flats` (integer, flats mail volume, default 0)
      - `letters` (integer, letters mail volume, default 0)
      - `parcels` (integer, parcels count, default 0)
      - `spurs` (integer, SPRs count, default 0)
      - `curtailed` (integer, curtailed flats, default 0)
      - `safety_talk` (integer, safety talk minutes, default 0)
      - `street_time` (integer, actual street time in minutes)
      - `street_time_normalized` (integer, normalized street time)
      - `office_time` (integer, office time in minutes)
      - `day_type` (text, normal/monday/thirdBundle)
      - `third_bundle` (boolean, default false)
      - `overtime` (integer, overtime minutes)
      - `auxiliary_assistance` (boolean, received help, default false)
      - `mail_not_delivered` (boolean, brought back mail, default false)
      - `notes` (text, optional notes)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Users can only access their own routes and history
    - Authenticated users can create, read, update, and delete their own data
    
  3. Indexes
    - Index on route_history(route_id, date) for fast lookups
    - Index on routes(user_id) for user queries
*/

-- Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route_number text NOT NULL,
  start_time text NOT NULL DEFAULT '07:30',
  tour_length numeric NOT NULL DEFAULT 8.5,
  lunch_duration integer NOT NULL DEFAULT 30,
  comfort_stop_duration integer NOT NULL DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, route_number)
);

-- Create route_history table
CREATE TABLE IF NOT EXISTS route_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  dps integer DEFAULT 0,
  flats integer DEFAULT 0,
  letters integer DEFAULT 0,
  parcels integer DEFAULT 0,
  spurs integer DEFAULT 0,
  curtailed integer DEFAULT 0,
  safety_talk integer DEFAULT 0,
  street_time integer,
  street_time_normalized integer,
  office_time integer,
  day_type text DEFAULT 'normal',
  third_bundle boolean DEFAULT false,
  overtime integer,
  auxiliary_assistance boolean DEFAULT false,
  mail_not_delivered boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(route_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_route_history_route_date ON route_history(route_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_routes_user ON routes(user_id);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_history ENABLE ROW LEVEL SECURITY;

-- Routes policies
CREATE POLICY "Users can view own routes"
  ON routes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own routes"
  ON routes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes"
  ON routes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes"
  ON routes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Route history policies
CREATE POLICY "Users can view own route history"
  ON route_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_history.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own route history"
  ON route_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_history.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own route history"
  ON route_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_history.route_id
      AND routes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_history.route_id
      AND routes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own route history"
  ON route_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_history.route_id
      AND routes.user_id = auth.uid()
    )
  );