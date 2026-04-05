import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';
import { runMigrations } from './migrate';

let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite;
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  const filePath = process.env.SQLITE_PATH || join(dataDir, 'graphluence.db');
  _sqlite = new Database(filePath);
  _sqlite.pragma('journal_mode = WAL');
  runMigrations(_sqlite);
  return _sqlite;
}

export function getDb() {
  if (_db) return _db;
  const sqlite = getSqlite();
  _db = drizzle(sqlite, { schema });
  return _db;
}

/** Backwards-compatible async hook (no network I/O). */
export async function connectDB() {
  getDb();
}
