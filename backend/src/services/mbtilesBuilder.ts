import * as turf from '@turf/turf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { run, queryOne } from '../database';

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

export function estimateTilesForRoute(geojsonStr: string, maxZoom: number = 15): TileEstimation {
  const geojson = typeof geojsonStr === 'string' ? JSON.parse(geojsonStr) : geojsonStr;
  const targetMaxZoom = maxZoom >= 16 ? 16 : 15;
  const zoomLevels: number[] = [];
  for (let z = 8; z <= targetMaxZoom; z++) {
    zoomLevels.push(z);
  }

  const tiles = getTilesForRoute(geojson, zoomLevels, 1.0);

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

export function getTiandituTileUrl(z: number, x: number, y: number, tk: string): string {
  const sub = (x + y + z) % 8;
  return `https://t${sub}.tianditu.gov.cn/DataServer?T=img_w&x=${x}&y=${y}&l=${z}&tk=${tk}`;
}

const activeJobs = new Map<string, { status: string, total: number, downloaded: number, error?: string }>();

export async function buildMBTiles(
  routeId: number,
  geojsonStr: string,
  options: { tk?: string; maxZoom?: number; forceRebuild?: boolean } = {}
) {
  let tk = options.tk;
  if (!tk) {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', ['tianditu_tk']);
    tk = row?.value || process.env.TIANDITU_TK;
  }

  if (!tk || tk.trim() === '') {
    throw new Error('未配置天地图 API Key (tianditu_tk)，请在后台设置中填入');
  }

  const maxZoom = options.maxZoom && options.maxZoom >= 16 ? 16 : 15;
  const zoomLevels: number[] = [];
  for (let z = 8; z <= maxZoom; z++) {
    zoomLevels.push(z);
  }

  const geojson = typeof geojsonStr === 'string' ? JSON.parse(geojsonStr) : geojsonStr;
  const tiles = getTilesForRoute(geojson, zoomLevels, 1.0);

  const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
  if (!fs.existsSync(mbtilesDir)) {
    fs.mkdirSync(mbtilesDir, { recursive: true });
  }

  const dbPath = path.join(mbtilesDir, `route_${routeId}.mbtiles`);

  // Handle force rebuild vs resume
  if (options.forceRebuild && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (name text, value text);
    CREATE UNIQUE INDEX IF NOT EXISTS name on metadata (name);
    CREATE TABLE IF NOT EXISTS tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);
    CREATE UNIQUE INDEX IF NOT EXISTS tile_index on tiles (zoom_level, tile_column, tile_row);
  `);

  const bbox = turf.bbox(geojson);
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const centerLon = (bbox[0] + bbox[2]) / 2;

  const upsertMeta = db.prepare('INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)');
  upsertMeta.run('name', `Route ${routeId}`);
  upsertMeta.run('type', 'baselayer');
  upsertMeta.run('version', '1');
  upsertMeta.run('description', `Offline map for Route ${routeId}`);
  upsertMeta.run('format', 'jpg');
  upsertMeta.run('bounds', bbox.join(','));
  upsertMeta.run('center', `${centerLon},${centerLat},13`);
  upsertMeta.run('minzoom', '8');
  upsertMeta.run('maxzoom', String(maxZoom));

  // Check already existing tiles for resume support
  const existingRows = db.prepare('SELECT zoom_level, tile_column, tile_row FROM tiles').all() as Array<{
    zoom_level: number;
    tile_column: number;
    tile_row: number;
  }>;
  const existingSet = new Set<string>();
  for (const r of existingRows) {
    existingSet.add(`${r.zoom_level}/${r.tile_column}/${r.tile_row}`);
  }

  let alreadyDownloadedCount = 0;
  const pendingTiles: TileInfo[] = [];

  for (const t of tiles) {
    const tmsY = Math.pow(2, t.z) - 1 - t.y;
    if (existingSet.has(`${t.z}/${t.x}/${tmsY}`)) {
      alreadyDownloadedCount++;
    } else {
      pendingTiles.push(t);
    }
  }

  const insertTile = db.prepare('INSERT OR IGNORE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)');

  activeJobs.set(routeId.toString(), {
    status: 'downloading',
    total: tiles.length,
    downloaded: alreadyDownloadedCount
  });

  run('UPDATE routes SET tile_status = ?, total_tiles = ?, downloaded_tiles = ?, max_zoom = ? WHERE id = ?', [
    'downloading',
    tiles.length,
    alreadyDownloadedCount,
    maxZoom,
    routeId
  ]);

  // Rate Limiting: 4 req/s max, 2 concurrent max, ~250ms interval between launches
  let failedTilesCount = 0;
  let downloadedCount = alreadyDownloadedCount;

  const downloadSingleTile = async (t: TileInfo) => {
    const url = getTiandituTileUrl(t.z, t.x, t.y, tk as string);
    const tmsY = Math.pow(2, t.z) - 1 - t.y;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 6000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://map.tianditu.gov.cn/'
          }
        });

        insertTile.run(t.z, t.x, tmsY, Buffer.from(response.data));
        downloadedCount++;

        const job = activeJobs.get(routeId.toString());
        if (job) {
          job.downloaded = downloadedCount;
        }

        if (downloadedCount % 20 === 0 || downloadedCount === tiles.length) {
          run('UPDATE routes SET downloaded_tiles = ? WHERE id = ?', [downloadedCount, routeId]);
        }
        return;
      } catch (err) {
        if (attempt === 3) {
          console.error(`[Tianditu Tile] Failed tile ${t.z}/${t.x}/${t.y} after 3 attempts`, err);
          failedTilesCount++;
        } else {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
  };

  // Safe Rate Limiter execution (4 req/s)
  const runWithRateLimit = async () => {
    let index = 0;
    const running = new Set<Promise<any>>();

    while (index < pendingTiles.length) {
      const tile = pendingTiles[index++];
      const p = downloadSingleTile(tile).finally(() => running.delete(p));
      running.add(p);

      if (running.size >= 2) {
        await Promise.race(running);
      }
      await new Promise(r => setTimeout(r, 260)); // ~3.8 req/sec max
    }

    await Promise.all(Array.from(running));
  };

  try {
    if (pendingTiles.length > 0) {
      await runWithRateLimit();
    }

    const stats = fs.statSync(dbPath);
    const mbSize = stats.size / (1024 * 1024);

    activeJobs.set(routeId.toString(), {
      status: 'completed',
      total: tiles.length,
      downloaded: downloadedCount
    });

    run('UPDATE routes SET tile_status = ?, downloaded_tiles = ?, file_size_mb = ? WHERE id = ?', [
      'completed',
      tiles.length,
      mbSize,
      routeId
    ]);
  } catch (err: any) {
    activeJobs.set(routeId.toString(), {
      status: 'failed',
      total: tiles.length,
      downloaded: downloadedCount,
      error: err.message
    });
    run('UPDATE routes SET tile_status = ?, error_message = ? WHERE id = ?', [
      'failed',
      err.message,
      routeId
    ]);
  } finally {
    console.log(`[MBTiles Build Stats] Route ${routeId} finished. Total Target: ${tiles.length}, Existing: ${alreadyDownloadedCount}, Failed: ${failedTilesCount}`);
    db.close();
    setTimeout(() => activeJobs.delete(routeId.toString()), 60000);
  }
}

export function getJobStatus(routeId: string) {
  return activeJobs.get(routeId);
}
