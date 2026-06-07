/**
 * FlowOS - src/services/storage/local.storage.ts
 * Local-disk storage for development. Writes files under UPLOAD_DIR and returns a
 * URL served statically by Express at /uploads.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import type { IStorageService, StoredFile, StorageResult } from './storage.interface';

export class LocalStorageService implements IStorageService {
  async save(file: StoredFile): Promise<StorageResult> {
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    const ext = extname(file.originalName) || mimeToExt(file.mimeType);
    const key = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    await writeFile(join(env.UPLOAD_DIR, key), file.buffer);
    return { key, url: `/uploads/${key}` };
  }
}

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  return '';
}
