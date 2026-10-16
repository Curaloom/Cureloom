import Database from 'better-sqlite3';
import { SCHEMA, type DB } from './schema';

export function openDb(file: string): DB {
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db as unknown as DB;
}
