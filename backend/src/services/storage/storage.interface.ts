/**
 * FlowOS - src/services/storage/storage.interface.ts
 * Contract for storing uploaded files (avatars, business logos). Local-disk in dev;
 * swappable for S3 / Firebase Storage later without touching callers.
 */
export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface StorageResult {
  key: string;
  url: string;
}

export interface IStorageService {
  save(file: StoredFile): Promise<StorageResult>;
}
