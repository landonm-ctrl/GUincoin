import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// File size limit: 5MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const publicUploadDir = path.join(uploadDir, 'store');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(publicUploadDir)) {
  fs.mkdirSync(publicUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow PDF and image files
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, publicUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const publicUpload = multer({
  storage: publicStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export const getFileUrl = (filename: string): string => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${baseUrl}/api/files/${filename}`;
};

export const getPublicFileUrl = (filename: string): string => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${baseUrl}/api/files/public/${filename}`;
};

export const getPublicUploadDir = (): string => publicUploadDir;
