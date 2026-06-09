/**
 * FlowOS - src/modules/media/media.controller.ts
 * Image upload handler. Persists the file via the storage service and returns an
 * absolute URL the client can use as a business logo / thumbnail or avatar.
 */
import type { Request, Response } from 'express';
import { storage } from '../../container';
import { BadRequestError } from '../../lib/errors';

export async function upload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new BadRequestError('A valid image file is required (form field "file", max 5MB).');
  }

  const result = await storage.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
  });

  // Return a RELATIVE path (e.g. "/uploads/abc.png"). The client resolves it
  // against whatever host it uses to reach the API, so images keep working across
  // networks and survive tunnel/host changes — an absolute upload-time host would
  // bake in localhost/LAN and fail to load on other devices.
  res.status(201).json({ url: result.url, key: result.key });
}
