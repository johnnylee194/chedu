import { Router, Request, Response } from 'express';
import { query, run, queryOne } from '../database';
import { estimateTilesForRoute, buildMBTiles, getJobStatus } from '../services/mbtilesBuilder';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Require authentication for all route endpoints
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  try {
    let routes;
    if (req.user!.role === 'admin') {
      routes = query(`
        SELECT *
        FROM routes
        ORDER BY created_at DESC
      `);
    } else {
      routes = query(`
        SELECT r.*
        FROM routes r
        INNER JOIN user_routes ur ON r.id = ur.route_id
        WHERE ur.user_id = ?
        ORDER BY r.created_at DESC
      `, [req.user!.userId]);
    }

    // Safely parse geojson
    const parsedRoutes = routes.map((r: any) => {
       if (r.geojson && typeof r.geojson === 'string') {
          try {
              r.geojson = JSON.parse(r.geojson);
          } catch(e) {}
       }
       return r;
    });

    res.json(parsedRoutes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    if (req.user!.role !== 'admin') {
      const access = queryOne('SELECT 1 FROM user_routes WHERE user_id = ? AND route_id = ?', [req.user!.userId, routeId]);
      if (!access) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this route' });
      }
    }

    const routes = query('SELECT * FROM routes WHERE id = ?', [routeId]);
    const route = routes[0] as any;

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const tracks = query('SELECT * FROM route_tracks WHERE route_id = ?', [routeId]);
    const pois = query('SELECT * FROM pois WHERE route_id = ?', [routeId]);
    const images = query('SELECT * FROM route_images WHERE route_id = ? ORDER BY order_index', [routeId]);

    if (route.geojson && typeof route.geojson === 'string') {
       try {
           route.geojson = JSON.parse(route.geojson);
       } catch(e) {}
    }

    res.json({
      ...route,
      tracks: tracks.map((t: any) => ({ ...t, track_data: JSON.parse(t.track_data) })),
      pois,
      images
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

router.post('/', requireAdmin, (req: Request, res: Response) => {
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
      images
    } = req.body;

    const geojsonStr = geojson ? JSON.stringify(geojson) : null;

    const result = run(`
      INSERT INTO routes (
        title, description, total_distance, estimated_duration,
        total_ascent, max_elevation, difficulty, vehicle_type, geojson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description,
      total_distance,
      estimated_duration ?? null,
      total_ascent ?? null,
      max_elevation ?? null,
      difficulty ?? null,
      vehicle_type ?? null,
      geojsonStr
    ]);

    const routeId = result.lastInsertRowid as number;

    if (images && Array.isArray(images)) {
      images.forEach((image: any, index: number) => {
        run(`
          INSERT INTO route_images (route_id, image_url, caption, order_index)
          VALUES (?, ?, ?, ?)
        `, [
          routeId,
          image.image_url,
          image.caption,
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

router.put('/:id', requireAdmin, (req: Request, res: Response) => {
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
      vehicle_type
    } = req.body;

    run(`
      UPDATE routes SET
        title = ?, description = ?, total_distance = ?, estimated_duration = ?,
        total_ascent = ?, max_elevation = ?, difficulty = ?, vehicle_type = ?,
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
      routeId
    ]);

    res.json({ message: 'Route updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update route' });
  }
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    run('DELETE FROM routes WHERE id = ?', [routeId]);

    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

router.get('/:id/estimate-tiles', (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    if (req.user!.role !== 'admin') {
      const access = queryOne('SELECT 1 FROM user_routes WHERE user_id = ? AND route_id = ?', [req.user!.userId, routeId]);
      if (!access) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this route' });
      }
    }

    const route = queryOne('SELECT geojson FROM routes WHERE id = ?', [routeId]);
    if (!route || !route.geojson) {
       return res.status(404).json({ error: 'Route or geojson not found' });
    }

    const estimation = estimateTilesForRoute(route.geojson);
    res.json(estimation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to estimate tiles' });
  }
});

router.post('/:id/build-mbtiles', requireAdmin, (req: Request, res: Response) => {
    try {
        const routeId = parseInt(req.params.id);
        const route = queryOne('SELECT geojson FROM routes WHERE id = ?', [routeId]);
        if (!route || !route.geojson) {
           return res.status(404).json({ error: 'Route or geojson not found' });
        }

        const sourceUrl = req.body.sourceUrl;

        // Kick off background job
        buildMBTiles(routeId, route.geojson, sourceUrl).catch(console.error);

        res.json({ message: 'Build job started' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start build job' });
    }
});

router.get('/:id/tile-status', (req: Request, res: Response) => {
    try {
        const routeId = req.params.id;

        if (req.user!.role !== 'admin') {
          const access = queryOne('SELECT 1 FROM user_routes WHERE user_id = ? AND route_id = ?', [req.user!.userId, routeId]);
          if (!access) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this route' });
          }
        }

        // check memory first for live updates
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

router.get('/:id/mbtiles', (req: Request, res: Response) => {
    try {
        const routeId = req.params.id;

        if (req.user!.role !== 'admin') {
          const access = queryOne('SELECT 1 FROM user_routes WHERE user_id = ? AND route_id = ?', [req.user!.userId, routeId]);
          if (!access) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this route' });
          }
        }

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

router.get('/:id/tiles/:z/:x/:y', (req: Request, res: Response) => {
    try {
        const { id, z, x, y } = req.params;

        if (req.user!.role !== 'admin') {
          const access = queryOne('SELECT 1 FROM user_routes WHERE user_id = ? AND route_id = ?', [req.user!.userId, id]);
          if (!access) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this route' });
          }
        }

        const mbtilesDir = path.resolve(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data', 'mbtiles');
        const dbPath = path.join(mbtilesDir, `route_${id}.mbtiles`);

        if (!fs.existsSync(dbPath)) {
             return res.status(404).json({ error: 'MBTiles file not found' });
        }

        const db = new Database(dbPath, { readonly: true });

        // MBTiles standard uses TMS where y is reversed from standard slippy map XYZ
        const tmsY = Math.pow(2, parseInt(z)) - 1 - parseInt(y);

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
