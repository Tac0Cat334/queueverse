-- Derived analytics aggregates for QueueVerse
-- Run after schema.sql in Supabase SQL Editor

-- Precomputed slot averages (5-minute buckets) per ride
CREATE TABLE IF NOT EXISTS ride_slot_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id INTEGER NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute_bucket SMALLINT NOT NULL CHECK (minute_bucket IN (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)),
  avg_wait NUMERIC(6, 2) NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  volatility NUMERIC(6, 2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ride_id, day_of_week, hour, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_slot_agg_ride_dow
  ON ride_slot_aggregates(ride_id, day_of_week, hour, minute_bucket);

-- Hourly rollups for faster baseline queries
CREATE TABLE IF NOT EXISTS ride_hourly_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id INTEGER NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  avg_wait NUMERIC(6, 2) NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  min_wait INTEGER,
  max_wait INTEGER,
  downtime_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ride_id, day_of_week, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_agg_ride_dow
  ON ride_hourly_aggregates(ride_id, day_of_week, hour);

-- Ride-level summary metrics refreshed after sync
CREATE TABLE IF NOT EXISTS ride_analytics_summary (
  ride_id INTEGER PRIMARY KEY REFERENCES rides(ride_id) ON DELETE CASCADE,
  volatility_score SMALLINT,
  downtime_percent SMALLINT,
  best_hour SMALLINT,
  best_avg_wait INTEGER,
  peak_hour SMALLINT,
  peak_avg_wait INTEGER,
  unique_data_days INTEGER DEFAULT 0,
  total_snapshots INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ride_slot_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_hourly_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_analytics_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on ride_slot_aggregates"
  ON ride_slot_aggregates FOR SELECT USING (true);

CREATE POLICY "Allow public read on ride_hourly_aggregates"
  ON ride_hourly_aggregates FOR SELECT USING (true);

CREATE POLICY "Allow public read on ride_analytics_summary"
  ON ride_analytics_summary FOR SELECT USING (true);
