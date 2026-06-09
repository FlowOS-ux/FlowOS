/**
 * FlowOS - src/modules/media/media.routes.ts
 * Authenticated image upload. `POST /media` (multipart, field "file") -> { url, key }.
 */
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './media.controller';

const ALLOWED = /^image\/(png|jpe?g|webp|gif)$/;

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.test(file.mimetype)),
});

const router = Router();
router.post('/', authenticate, uploader.single('file'), controller.upload);

export default router;
