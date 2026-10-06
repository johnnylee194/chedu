import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/routes.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: Database.Database | null = null;

export const initDatabase = async () => {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      total_distance REAL,
      estimated_duration INTEGER,
      total_ascent REAL,
      max_elevation REAL,
      difficulty INTEGER DEFAULT 1,
      vehicle_type TEXT,
      geojson TEXT,
      tile_status TEXT DEFAULT 'idle',
      total_tiles INTEGER DEFAULT 0,
      downloaded_tiles INTEGER DEFAULT 0,
      file_size_mb REAL DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      track_data TEXT NOT NULL,
      track_type TEXT DEFAULT 'line',
      difficulty TEXT DEFAULT 'easy',
      color TEXT DEFAULT '#00FF00'
    );

    CREATE TABLE IF NOT EXISTS pois (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS route_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_route_tracks_route_id ON route_tracks(route_id);
    CREATE INDEX IF NOT EXISTS idx_pois_route_id ON pois(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_images_route_id ON route_images(route_id);
  `);

  // Reset any downloading jobs to failed on startup
  db.prepare("UPDATE routes SET tile_status = 'failed', error_message = 'Interrupted by server restart' WHERE tile_status = 'downloading'").run();
};

export const query = <T = any>(sql: string, params: any[] = []): T[] => {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql).all(...params) as T[];
};

export const queryOne = <T = any>(sql: string, params: any[] = []): T | undefined => {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql).get(...params) as T | undefined;
}

export const run = (sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } => {
  if (!db) throw new Error('Database not initialized');
  const info = db.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
};

export default () => {
  if (!db) throw new Error('Database not initialized');
  return db;
};
