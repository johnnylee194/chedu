import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/routes.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: Database | null = null;

export const initDatabase = async () => {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
      created_by INTEGER,
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

    CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
    CREATE INDEX IF NOT EXISTS idx_route_tracks_route_id ON route_tracks(route_id);
    CREATE INDEX IF NOT EXISTS idx_pois_route_id ON pois(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_images_route_id ON route_images(route_id);
  `);

  saveDatabase();
};

const saveDatabase = () => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

export const query = <T = any>(sql: string, params: any[] = []): T[] => {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
};

export const run = (sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } => {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  
  const result = db.exec('SELECT last_insert_rowid()');
  const lastInsertRowid = result.length > 0 && result[0].values.length > 0 
    ? result[0].values[0][0] as number 
    : 0;
  
  const changesResult = db.exec('SELECT changes()');
  const changes = changesResult.length > 0 && changesResult[0].values.length > 0
    ? changesResult[0].values[0][0] as number
    : 0;
  
  saveDatabase();
  
  return { lastInsertRowid, changes };
};

export default db;
