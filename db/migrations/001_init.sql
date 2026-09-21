CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS tourism_regions (
  id text PRIMARY KEY,
  name text NOT NULL,
  center extensions.geography(POINT, 4326) NOT NULL,
  radius_meters integer NOT NULL CHECK (radius_meters > 0)
);

INSERT INTO tourism_regions (id, name, center, radius_meters)
VALUES
  ('old-town-wolyeonggyo', '원도심·월영교권', extensions.ST_SetSRID(extensions.ST_MakePoint(128.7364, 36.5652), 4326)::extensions.geography, 4200),
  ('hahoemaeul', '하회마을권', extensions.ST_SetSRID(extensions.ST_MakePoint(128.5185, 36.5392), 4326)::extensions.geography, 5000),
  ('dosan-yekki', '도산·예끼마을권', extensions.ST_SetSRID(extensions.ST_MakePoint(128.8432, 36.7434), 4326)::extensions.geography, 6000)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, center = EXCLUDED.center, radius_meters = EXCLUDED.radius_meters;

CREATE TABLE IF NOT EXISTS sync_leases (
  lease_name text PRIMARY KEY,
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_leases_expires_at_idx ON sync_leases (expires_at);

CREATE TABLE IF NOT EXISTS visitor_records (
  base_ymd date NOT NULL,
  signgu_code text NOT NULL,
  signgu_name text NOT NULL,
  visitor_type text NOT NULL,
  visitor_count numeric NOT NULL CHECK (visitor_count >= 0),
  synchronized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_ymd, signgu_code, visitor_type)
);

CREATE INDEX IF NOT EXISTS visitor_records_signgu_date_idx ON visitor_records (signgu_code, base_ymd DESC);

CREATE TABLE IF NOT EXISTS tourism_places (
  content_id text NOT NULL,
  collected_on date NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  source text NOT NULL,
  address text,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location extensions.geography(POINT, 4326) NOT NULL,
  region_id text REFERENCES tourism_regions(id),
  evidence_status text NOT NULL,
  synchronized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, collected_on)
);

CREATE INDEX IF NOT EXISTS tourism_places_location_gist_idx ON tourism_places USING GIST (location);
CREATE INDEX IF NOT EXISTS tourism_places_region_date_idx ON tourism_places (region_id, collected_on DESC);

CREATE TABLE IF NOT EXISTS published_snapshots (
  source_date date PRIMARY KEY,
  payload jsonb NOT NULL,
  sync_state text NOT NULL DEFAULT 'ready' CHECK (sync_state IN ('ready', 'stale')),
  published_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  affected_data text[] NOT NULL DEFAULT ARRAY[]::text[]
);

CREATE INDEX IF NOT EXISTS published_snapshots_published_at_idx ON published_snapshots (published_at DESC);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_date date NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('published', 'failed')),
  visitor_record_count integer,
  place_count integer
);

CREATE INDEX IF NOT EXISTS sync_runs_source_date_idx ON sync_runs (source_date DESC, started_at DESC);

CREATE TABLE IF NOT EXISTS validation_tasks (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  region_id text NOT NULL REFERENCES tourism_regions(id),
  title text NOT NULL,
  location text NOT NULL,
  question text NOT NULL,
  status text NOT NULL CHECK (status IN ('not-started', 'in-progress', 'completed', 'needs-improvement')),
  assigned_to text,
  scheduled_for date,
  notes text,
  result text,
  related_action text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_tasks_region_status_idx ON validation_tasks (region_id, status);
CREATE INDEX IF NOT EXISTS validation_tasks_scheduled_for_idx ON validation_tasks (scheduled_for);

ALTER TABLE tourism_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tourism_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE tourism_regions FROM anon, authenticated;
REVOKE ALL ON TABLE sync_leases FROM anon, authenticated;
REVOKE ALL ON TABLE visitor_records FROM anon, authenticated;
REVOKE ALL ON TABLE tourism_places FROM anon, authenticated;
REVOKE ALL ON TABLE published_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE sync_runs FROM anon, authenticated;
REVOKE ALL ON TABLE validation_tasks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validation_tasks_set_updated_at ON validation_tasks;
CREATE TRIGGER validation_tasks_set_updated_at
BEFORE UPDATE ON validation_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
