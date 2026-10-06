import * as turf from '@turf/turf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { run } from '../database';
// @ts-ignore
import pLimit from 'p-limit';

export interface TileEstimation {
  totalTiles: number;
  zoomBreakdown: Record<number, number>;
  estimatedMB: number;
}

interface TileInfo {
  z: number;
  x: number;
  y: number;
}

// Convert coordinates to tile [x,y] at given zoom level
function lon2tilex(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tiley(lat: number, zoom: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function getTilesForRoute(geojson: any, zoomLevels: number[], bufferKm: number = 1.0): TileInfo[] {
  const tileSet = new Set<string>();

  // Walk along all LineStrings, taking samples every 0.2km
  turf.segmentEach(geojson, (currentSegment) => {
    if (!currentSegment || !currentSegment.geometry) return;
    const line = turf.lineString(currentSegment.geometry.coordinates);
    const length = turf.length(line, { units: 'kilometers' });

    // Always include start and end points
    const samples: number[][] = [line.geometry.coordinates[0]];
    const step = 0.2;
    for (let d = step; d < length; d += step) {
      const pt = turf.along(line, d, { units: 'kilometers' });
      samples.push(pt.geometry.coordinates);
    }
    samples.push(line.geometry.coordinates[line.geometry.coordinates.length - 1]);

    for (const [lng, lat] of samples) {
      const deltaLat = bufferKm / 111.32;
      const deltaLng = bufferKm / (111.32 * Math.cos(lat * Math.PI / 180));

      const minLon = lng - deltaLng;
      const maxLon = lng + deltaLng;
      const minLat = lat - deltaLat;
      const maxLat = lat + deltaLat;

      for (const z of zoomLevels) {
        const minX = Math.max(0, lon2tilex(minLon, z));
        const maxX = Math.min(Math.pow(2, z) - 1, lon2tilex(maxLon, z));
        const minY = Math.max(0, lat2tiley(maxLat, z));
        const maxY = Math.min(Math.pow(2, z) - 1, lat2tiley(minLat, z));

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            tileSet.add(`${z}/${x}/${y}`);
          }
        }
      }
    }
  });

  const tiles: TileInfo[] = [];
  for (const key of tileSet) {
    const [z, x, y] = key.split('/').map(Number);
    tiles.push({ z, x, y });
  }
  return tiles;
}

export function estimateTilesForRoute(geojsonStr: string): TileEstimation {
  const geojson = JSON.parse(geojsonStr);
  const tiles = getTilesForRoute(geojson, [11, 12, 13, 14, 15, 16], 1.0);

  const breakdown: Record<number, number> = {};
  for (const t of tiles) {
    breakdown[t.z] = (breakdown[t.z] || 0) + 1;
  }

  return {
    totalTiles: tiles.length,
    zoomBreakdown: breakdown,
    // rough estimate 20KB per tile on average
    estimatedMB: (tiles.length * 20) / 1024
  };
}

const activeJobs = new Map<string, { status: string, total: number, downloaded: number, error?: string }>();

export async function buildMBTiles(
  routeId: number,
  geojsonStr: string,
  sourceUrlTemplate: string = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
) {
  const geojson = JSON.parse(geojsonStr);
  const tiles = getTilesForRoute(geojson, [11, 12, 13, 14, 15, 16], 1.0);

  const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
  if (!fs.existsSync(mbtilesDir)) {
    fs.mkdirSync(mbtilesDir, { recursive: true });
  }

  const dbPath = path.join(mbtilesDir, `route_${routeId}.mbtiles`);

  // Clean up existing if present
  if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE metadata (name text, value text);
    CREATE UNIQUE INDEX name on metadata (name);
    CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);
    CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);
  `);

  const bbox = turf.bbox(geojson);
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const centerLon = (bbox[0] + bbox[2]) / 2;

  const insertMeta = db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)');
  insertMeta.run('name', `Route ${routeId}`);
  insertMeta.run('type', 'baselayer');
  insertMeta.run('version', '1');
  insertMeta.run('description', `Offline map for Route ${routeId}`);
  insertMeta.run('format', 'jpg');
  insertMeta.run('bounds', bbox.join(','));
  insertMeta.run('center', `${centerLon},${centerLat},13`);

  const insertTile = db.prepare('INSERT OR IGNORE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)');

  activeJobs.set(routeId.toString(), { status: 'downloading', total: tiles.length, downloaded: 0 });

  run('UPDATE routes SET tile_status = ?, total_tiles = ?, downloaded_tiles = ? WHERE id = ?', ['downloading', tiles.length, 0, routeId]);

  const limit = pLimit(8);

  const downloadTile = async (t: TileInfo) => {
    let url = sourceUrlTemplate.replace('{z}', t.z.toString()).replace('{x}', t.x.toString()).replace('{y}', t.y.toString());

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });

            // TMS conversion: tile_row = (1 << z) - 1 - y
            const tmsY = Math.pow(2, t.z) - 1 - t.y;

            insertTile.run(t.z, t.x, tmsY, Buffer.from(response.data));

            const job = activeJobs.get(routeId.toString());
            if (job) {
                job.downloaded += 1;
                // Periodic DB flush every 50 tiles or so could be added here
                if (job.downloaded % 50 === 0) {
                     run('UPDATE routes SET downloaded_tiles = ? WHERE id = ?', [job.downloaded, routeId]);
                }
            }
            return;
        } catch (error) {
            if (attempt === 3) {
                console.error(`Failed to download tile ${t.z}/${t.x}/${t.y} after 3 attempts`, error);
            } else {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
  };

  try {
      await Promise.all(tiles.map(t => limit(() => downloadTile(t))));

      const stats = fs.statSync(dbPath);
      const mbSize = stats.size / (1024 * 1024);

      activeJobs.set(routeId.toString(), { status: 'completed', total: tiles.length, downloaded: tiles.length });
      run('UPDATE routes SET tile_status = ?, downloaded_tiles = ?, file_size_mb = ? WHERE id = ?', ['completed', tiles.length, mbSize, routeId]);
  } catch (err: any) {
      activeJobs.set(routeId.toString(), { status: 'failed', total: tiles.length, downloaded: 0, error: err.message });
      run('UPDATE routes SET tile_status = ?, error_message = ? WHERE id = ?', ['failed', err.message, routeId]);
  } finally {
      db.close();
      setTimeout(() => activeJobs.delete(routeId.toString()), 60000); // clear memory after 1 minute
  }
}

export function getJobStatus(routeId: string) {
    return activeJobs.get(routeId);
}
