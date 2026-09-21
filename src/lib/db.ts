import { Pool } from 'pg';

export type DatabaseRow = Record<string, unknown>;

export interface Database {
  query<T extends DatabaseRow = DatabaseRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  connect?: () => Promise<DatabaseConnection>;
}

export interface DatabaseConnection extends Database {
  release(): void;
}

let pool: Pool | undefined;
let testDatabase: Database | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabase(): Database {
  if (testDatabase) {
    return testDatabase;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  pool ??= new Pool({
    connectionString,
    max: 1,
    ssl: { rejectUnauthorized: true },
    allowExitOnIdle: true,
  });

  return pool as unknown as Database;
}

/** Test-only injection for isolated persistence behavior checks. */
export function setDatabaseForTests(database: Database): void {
  testDatabase = database;
}

/** Test-only cleanup for isolated persistence behavior checks. */
export function resetDatabaseForTests(): void {
  testDatabase = undefined;
}
