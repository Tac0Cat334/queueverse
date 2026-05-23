-- Epic Universe Wait Times - Supabase Schema (QueueVerse)
-- Run this in the Supabase SQL Editor

-- Rides table: stores ride metadata synced from Queue-Times API
CREATE TABLE IF NOT EXISTS rides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  land TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wait times table: historical wait time snapshots
CREATE TABLE IF NOT EXISTS wait_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id INTEGER NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  wait_time INTEGER NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_wait_times_ride_id ON wait_times(ride_id);
CREATE INDEX IF NOT EXISTS idx_wait_times_timestamp ON wait_times(timestamp);
CREATE INDEX IF NOT EXISTS idx_wait_times_ride_timestamp ON wait_times(ride_id, timestamp DESC);

-- Prevent duplicate entries within the same 5-minute window
ALTER TABLE wait_times
  ADD CONSTRAINT wait_times_ride_timestamp_unique UNIQUE (ride_id, timestamp);

-- Enable Row Level Security
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE wait_times ENABLE ROW LEVEL SECURITY;

-- Public read access for rides
CREATE POLICY "Allow public read on rides"
  ON rides FOR SELECT
  USING (true);

-- Public read access for wait times
CREATE POLICY "Allow public read on wait_times"
  ON wait_times FOR SELECT
  USING (true);

-- Service role can insert/update (handled via service role key in API routes)
-- No public insert/update policies needed

-- Function to auto-update updated_at on rides
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rides_updated_at
  BEFORE UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
