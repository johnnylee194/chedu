import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { query, run } from '../database';

const router = Router();

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const routes = query(`
      SELECT r.*, u.username as created_by_name
      FROM routes r
      LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);

    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const routeId = req.params.id;

    const routes = query('SELECT * FROM routes WHERE id = ?', [routeId]);
    const route = routes[0] as any;

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const tracks = query('SELECT * FROM route_tracks WHERE route_id = ?', [routeId]);
    const pois = query('SELECT * FROM pois WHERE route_id = ?', [routeId]);
    const images = query('SELECT * FROM route_images WHERE route_id = ? ORDER BY order_index', [routeId]);

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

router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
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
      tracks,
      pois,
      images
    } = req.body;

    const result = run(`
      INSERT INTO routes (
        title, description, total_distance, estimated_duration,
        total_ascent, max_elevation, difficulty, vehicle_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description,
      total_distance,
      estimated_duration,
      total_ascent,
      max_elevation,
      difficulty,
      vehicle_type,
      req.userId
    ]);

    const routeId = result.lastInsertRowid as number;

    if (tracks && Array.isArray(tracks)) {
      tracks.forEach((track: any) => {
        run(`
          INSERT INTO route_tracks (route_id, track_data, track_type, difficulty, color)
          VALUES (?, ?, ?, ?, ?)
        `, [
          routeId,
          JSON.stringify(track.track_data),
          track.track_type || 'line',
          track.difficulty || 'easy',
          track.color || '#00FF00'
        ]);
      });
    }

    if (pois && Array.isArray(pois)) {
      pois.forEach((poi: any) => {
        run(`
          INSERT INTO pois (route_id, name, type, description, latitude, longitude, elevation, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          routeId,
          poi.name,
          poi.type,
          poi.description,
          poi.latitude,
          poi.longitude,
          poi.elevation,
          poi.image_url
        ]);
      });
    }

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

router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
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

router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const routeId = req.params.id;

    run('DELETE FROM routes WHERE id = ?', [routeId]);

    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

export default router;
