import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseKML, parseGPX } from '../utils/parser';

const router = Router();
const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 100 * 1024 * 1024 }
});

router.post('/kml', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      console.error('[Upload] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    console.log('[Upload] File received:', {
      originalname: req.file.originalname,
      size: req.file.size,
      ext: ext,
      path: filePath
    });

    let result;
    if (ext === '.kml' || ext === '.kmz' || ext === '.ovkml') {
      console.log('[Upload] Parsing as KML/KMZ/OVKML...');
      result = await parseKML(filePath);
    } else if (ext === '.gpx') {
      console.log('[Upload] Parsing as GPX...');
      result = await parseGPX(filePath);
    } else {
      console.error('[Upload] Unsupported format:', ext);
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Please upload KML, KMZ, OVKML, or GPX' });
    }

    console.log('[Upload] Parse result:', {
      features: result.geojson.features.length,
      total_distance: result.metadata.total_distance
    });

    fs.unlinkSync(filePath);

    res.json({
      message: 'File parsed successfully',
      data: result
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    console.error('[Upload] Error stack:', error?.stack);
    res.status(500).json({ error: error.message || 'Failed to parse file' });
  }
});

export default router;
