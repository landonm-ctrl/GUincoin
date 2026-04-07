import { fromBuffer } from 'file-type';
import fs from 'fs';
import { AppError } from './errors';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', ...ALLOWED_IMAGE_TYPES];

/**
 * Validate uploaded file using magic-byte detection
 * Call this AFTER multer has written the file to disk
 */
export async function validateUploadedFile(
  filePath: string,
  allowedTypes: 'image' | 'document' = 'document',
  maxSizeBytes?: number
): Promise<void> {
  const stats = fs.statSync(filePath);

  if (maxSizeBytes && stats.size > maxSizeBytes) {
    fs.unlinkSync(filePath);
    throw new AppError(`File size exceeds maximum of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`, 400);
  }

  const buffer = Buffer.alloc(4100);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 4100, 0);
  fs.closeSync(fd);

  const type = await fromBuffer(buffer);
  const allowed = allowedTypes === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;

  if (!type || !allowed.includes(type.mime)) {
    fs.unlinkSync(filePath);
    const expectedTypes = allowedTypes === 'image'
      ? 'JPEG, PNG, GIF, or WebP'
      : 'PDF, JPEG, PNG, or GIF';
    throw new AppError(
      `Invalid file type${type ? ` (detected: ${type.mime})` : ''}. Only ${expectedTypes} files are allowed.`,
      400
    );
  }
}
