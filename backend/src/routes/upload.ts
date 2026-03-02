import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { parseKML, parseGPX } from '../utils/parser';

const router = Router();
const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

router.post('/kml', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let result;
    if (ext === '.kml' || ext === '.kmz') {
      result = await parseKML(filePath);
    } else if (ext === '.gpx') {
      result = await parseGPX(filePath);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Please upload KML, KMZ, or GPX' });
    }

    fs.unlinkSync(filePath);

    res.json({
      message: 'File parsed successfully',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to parse file' });
  }
});

export default router;
