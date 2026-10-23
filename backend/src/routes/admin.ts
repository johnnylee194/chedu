import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, run } from '../database';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Secure all admin routes
router.use(authenticate, requireAdmin);

router.get('/users', (req: Request, res: Response) => {
  try {
    const users = query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.created_at,
        COUNT(ur.route_id) as route_count
      FROM users u
      LEFT JOIN user_routes ur ON u.id = ur.user_id
      GROUP BY u.id
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users/:id/reset', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Generate an 8-character random alphanumeric string
    const temporaryPassword = crypto.randomBytes(4).toString('hex');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    run(`
      UPDATE users
      SET password_hash = ?, token_version = token_version + 1
      WHERE id = ?
    `, [passwordHash, userId]);

    res.json({
      message: 'Password reset successful',
      newPassword: temporaryPassword
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/users/:id/routes/:routeId', (req: Request, res: Response) => {
  try {
    const { id: userId, routeId } = req.params;

    // Use INSERT OR IGNORE to handle if it's already assigned
    run(`
      INSERT OR IGNORE INTO user_routes (user_id, route_id)
      VALUES (?, ?)
    `, [userId, routeId]);

    res.json({ message: 'Route assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign route' });
  }
});

router.delete('/users/:id/routes/:routeId', (req: Request, res: Response) => {
  try {
    const { id: userId, routeId } = req.params;

    run(`
      DELETE FROM user_routes
      WHERE user_id = ? AND route_id = ?
    `, [userId, routeId]);

    res.json({ message: 'Route removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove route' });
  }
});

export default router;
