import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync('db/migrations/001_init.sql', 'utf8');
const appTables = [
  'tourism_regions',
  'sync_leases',
  'visitor_records',
  'tourism_places',
  'published_snapshots',
  'sync_runs',
  'validation_tasks',
];

describe('database access boundary', () => {
  it('enables RLS and revokes browser Data API roles for every application table', () => {
    for (const table of appTables) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(migration).toContain(`REVOKE ALL ON TABLE ${table} FROM anon, authenticated;`);
    }
  });
});
