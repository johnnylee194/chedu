import { Router, Request, Response } from 'express';
import { query, run, queryOne } from '../database';
import { estimateTilesForRoute, buildMBTiles, getJobStatus } from '../services/mbtilesBuilder';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const router = Router();

// 1. Settings Endpoints
router.get('/settings', (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', ['tianditu_tk']);
    res.json({
      tianditu_tk: row?.value || process.env.TIANDITU_TK || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', (req: Request, res: Response) => {
  try {
    const { tianditu_tk } = req.body;
    run(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `, ['tianditu_tk', (tianditu_tk || '').trim()]);

    res.json({ message: 'Settings updated successfully', tianditu_tk: (tianditu_tk || '').trim() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 2. Redeem Endpoint (Used by Mobile App)
router.post('/redeem', (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '请输入有效的兑换码' });
    }

    const cleanInput = code.trim().toUpperCase();
    const compactInput = cleanInput.replace(/[^A-Z0-9]/g, '');

    const routes = query(`
      SELECT * FROM routes
    `);

    const matched = routes.find((r: any) => {
      const standard = (r.redeem_code || `CHEDU-${String(r.id).padStart(4, '0')}`).toUpperCase();
      const compactStandard = standard.replace(/[^A-Z0-9]/g, '');
      const paddedId = String(r.id).padStart(4, '0');

      return (
        cleanInput === standard ||
        compactInput === compactStandard ||
        cleanInput === paddedId ||
        cleanInput === `CHEDU-${r.id}`
      );
    });

    if (!matched) {
      return res.status(404).json({ error: '未找到匹配的路线兑换码，请检查输入或联系路线发布者' });
    }

    const images = query('SELECT * FROM route_images WHERE route_id = ? ORDER BY order_index ASC', [matched.id]);
    let parsedGeojson = matched.geojson;
    if (parsedGeojson && typeof parsedGeojson === 'string') {
      try {
        parsedGeojson = JSON.parse(parsedGeojson);
      } catch (e) {}
    }

    res.json({
      ...matched,
      geojson: parsedGeojson,
      images,
      redeem_code: matched.redeem_code || `CHEDU-${String(matched.id).padStart(4, '0')}`
    });
  } catch (error) {
    res.status(500).json({ error: '兑换核销失败' });
  }
});

// 3. List Routes (Includes images for BBS cards)
router.get('/', (req: Request, res: Response) => {
  try {
    const routes = query(`
      SELECT *
      FROM routes
      ORDER BY created_at DESC
    `);

    const parsedRoutes = routes.map((r: any) => {
      if (r.geojson && typeof r.geojson === 'string') {
        try {
          r.geojson = JSON.parse(r.geojson);
        } catch (e) {}
      }

      const images = query('SELECT * FROM route_images WHERE route_id = ? ORDER BY order_index ASC', [r.id]);
      return {
        ...r,
        redeem_code: r.redeem_code || `CHEDU-${String(r.id).padStart(4, '0')}`,
        images
      };
    });

    res.json(parsedRoutes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// 4. Route Detail
router.get('/:id', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    const routes = query('SELECT * FROM routes WHERE id = ?', [routeId]);
    const route = routes[0] as any;

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const tracks = query('SELECT * FROM route_tracks WHERE route_id = ?', [routeId]);
    const pois = query('SELECT * FROM pois WHERE route_id = ?', [routeId]);
    const images = query('SELECT * FROM route_images WHERE route_id = ? ORDER BY order_index ASC', [routeId]);

    if (route.geojson && typeof route.geojson === 'string') {
      try {
        route.geojson = JSON.parse(route.geojson);
      } catch (e) {}
    }

    res.json({
      ...route,
      redeem_code: route.redeem_code || `CHEDU-${String(route.id).padStart(4, '0')}`,
      tracks: tracks.map((t: any) => ({ ...t, track_data: JSON.parse(t.track_data) })),
      pois,
      images
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

// 5. Create Route
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      total_distance,
      estimated_duration,
      total_ascent,
      max_elevation,
      difficulty,
      vehicle_type,
      geojson,
      images,
      redeem_code,
      max_zoom
    } = req.body;

    const geojsonStr = geojson ? JSON.stringify(geojson) : null;

    const result = run(`
      INSERT INTO routes (
        title, description, total_distance, estimated_duration,
        total_ascent, max_elevation, difficulty, vehicle_type, geojson,
        redeem_code, max_zoom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description,
      total_distance,
      estimated_duration ?? null,
      total_ascent ?? null,
      max_elevation ?? null,
      difficulty ?? null,
      vehicle_type ?? null,
      geojsonStr,
      redeem_code ?? null,
      max_zoom ?? 15
    ]);

    const routeId = result.lastInsertRowid as number;

    // Ensure redeem_code is set
    if (!redeem_code || redeem_code.trim() === '') {
      run('UPDATE routes SET redeem_code = ? WHERE id = ?', [`CHEDU-${String(routeId).padStart(4, '0')}`, routeId]);
    }

    if (images && Array.isArray(images)) {
      images.forEach((image: any, index: number) => {
        run(`
          INSERT INTO route_images (route_id, image_url, caption, order_index)
          VALUES (?, ?, ?, ?)
        `, [
          routeId,
          image.image_url,
          image.caption || '',
          index
        ]);
      });
    }

    res.status(201).json({
      message: 'Route created successfully',
      routeId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create route' });
  }
});

// 6. Update Route (Supports BBS Post + Images sync + Redeem Code)
router.put('/:id', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;
    const {
      title,
      description,
      total_distance,
      estimated_duration,
      total_ascent,
      max_elevation,
      difficulty,
      vehicle_type,
      redeem_code,
      max_zoom,
      images
    } = req.body;

    const fallbackCode = `CHEDU-${String(routeId).padStart(4, '0')}`;
    const finalCode = redeem_code && redeem_code.trim() !== '' ? redeem_code.trim() : fallbackCode;

    run(`
      UPDATE routes SET
        title = ?, description = ?, total_distance = ?, estimated_duration = ?,
        total_ascent = ?, max_elevation = ?, difficulty = ?, vehicle_type = ?,
        redeem_code = ?, max_zoom = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title,
      description,
      total_distance,
      estimated_duration,
      total_ascent,
      max_elevation,
      difficulty,
      vehicle_type,
      finalCode,
      max_zoom ?? 15,
      routeId
    ]);

    // Update images if provided
    if (images && Array.isArray(images)) {
      run('DELETE FROM route_images WHERE route_id = ?', [routeId]);
      images.forEach((img: any, idx: number) => {
        run(`
          INSERT INTO route_images (route_id, image_url, caption, order_index)
          VALUES (?, ?, ?, ?)
        `, [
          routeId,
          img.image_url,
          img.caption || '',
          idx
        ]);
      });
    }

    res.json({ message: 'Route updated successfully', redeem_code: finalCode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update route' });
  }
});

// 7. Delete Route
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    run('DELETE FROM routes WHERE id = ?', [routeId]);
    run('DELETE FROM route_images WHERE route_id = ?', [routeId]);
    run('DELETE FROM route_tracks WHERE route_id = ?', [routeId]);
    run('DELETE FROM pois WHERE route_id = ?', [routeId]);

    const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
    const dbPath = path.join(mbtilesDir, `route_${routeId}.mbtiles`);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// 8. Estimate Tiles
router.get('/:id/estimate-tiles', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;
    const maxZoom = req.query.maxZoom ? parseInt(req.query.maxZoom as string, 10) : 15;

    const route = queryOne('SELECT geojson FROM routes WHERE id = ?', [routeId]);
    if (!route || !route.geojson) {
      return res.status(404).json({ error: 'Route or geojson not found' });
    }

    const estimation = estimateTilesForRoute(route.geojson, maxZoom);
    res.json(estimation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to estimate tiles' });
  }
});

// 9. Build MBTiles
router.post('/:id/build-mbtiles', (req: Request, res: Response) => {
  try {
    const routeId = parseInt(req.params.id, 10);
    const { maxZoom, forceRebuild } = req.body;

    const route = queryOne('SELECT geojson FROM routes WHERE id = ?', [routeId]);
    if (!route || !route.geojson) {
      return res.status(404).json({ error: 'Route or geojson not found' });
    }

    buildMBTiles(routeId, route.geojson, {
      maxZoom: maxZoom ? parseInt(maxZoom, 10) : 15,
      forceRebuild: !!forceRebuild
    }).catch(console.error);

    res.json({ message: 'Build job started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start build job' });
  }
});

// 10. Tile Status
router.get('/:id/tile-status', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    const activeJob = getJobStatus(routeId);
    if (activeJob) {
      return res.json(activeJob);
    }

    const route = queryOne('SELECT tile_status as status, total_tiles as total, downloaded_tiles as downloaded, file_size_mb as fileSizeMB, error_message as errorMessage FROM routes WHERE id = ?', [routeId]);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// 11. Download MBTiles
router.get('/:id/mbtiles', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;
    const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
    const dbPath = path.join(mbtilesDir, `route_${routeId}.mbtiles`);

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'MBTiles file not found' });
    }

    res.download(dbPath, `route_${routeId}.mbtiles`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download mbtiles file' });
  }
});

// 12. Tile stream
router.get('/:id/tiles/:z/:x/:y', (req: Request, res: Response) => {
  try {
    const { id, z, x, y } = req.params;
    const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
    const dbPath = path.join(mbtilesDir, `route_${id}.mbtiles`);

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'MBTiles file not found' });
    }

    const db = new Database(dbPath, { readonly: true });
    const tmsY = Math.pow(2, parseInt(z, 10)) - 1 - parseInt(y, 10);

    const tile = db.prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?').get(z, x, tmsY) as any;
    db.close();

    if (!tile || !tile.tile_data) {
      return res.status(404).send('Tile not found');
    }

    res.set('Content-Type', 'image/jpeg');
    res.send(tile.tile_data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream tile' });
  }
});

export default router;
