import express from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import bannerService, { BANNER_DIMENSIONS, PageName } from '../../services/bannerService';
import aiImageService from '../../services/aiImageService';
import { AppError } from '../../utils/errors';
import { validateUploadedFile } from '../../utils/fileValidation';
import { BannerPosition } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for banner image uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const bannerUploadDir = path.join(uploadDir, 'banners');

// Ensure banner upload directory exists
if (!fs.existsSync(bannerUploadDir)) {
  fs.mkdirSync(bannerUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, bannerUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// Schema for creating a banner
const createBannerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    position: z.nativeEnum(BannerPosition),
    campaignId: z.string().uuid().optional().nullable(),
    showOnDashboard: z.boolean().optional(),
    showOnTransfers: z.boolean().optional(),
    showOnStore: z.boolean().optional(),
    showOnWellness: z.boolean().optional(),
    showOnManager: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
    imagePositionX: z.enum(['left', 'center', 'right']).optional(),
    imagePositionY: z.enum(['top', 'center', 'bottom']).optional(),
    textOverlay: z.object({
      text: z.string(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      fontColor: z.string().optional(),
      fontWeight: z.string().optional(),
      position: z.enum(['top', 'center', 'bottom']).optional(),
      backgroundColor: z.string().optional(),
      padding: z.number().optional(),
    }).optional().nullable(),
  }),
});

// Schema for updating a banner
const updateBannerSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    position: z.nativeEnum(BannerPosition).optional(),
    campaignId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
    showOnDashboard: z.boolean().optional(),
    showOnTransfers: z.boolean().optional(),
    showOnStore: z.boolean().optional(),
    showOnWellness: z.boolean().optional(),
    showOnManager: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
    imagePositionX: z.enum(['left', 'center', 'right']).optional(),
    imagePositionY: z.enum(['top', 'center', 'bottom']).optional(),
    textOverlay: z.object({
      text: z.string(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      fontColor: z.string().optional(),
      fontWeight: z.string().optional(),
      position: z.enum(['top', 'center', 'bottom']).optional(),
      backgroundColor: z.string().optional(),
      padding: z.number().optional(),
    }).optional().nullable(),
  }),
});

// Schema for generating AI image
const generateAiImageSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    customPrompt: z.string().optional(),
    guidedOptions: z.object({
      mood: z.enum(['energetic', 'calm', 'professional', 'playful', 'inspiring']).optional(),
      style: z.enum(['photorealistic', 'illustrated', 'abstract', 'minimalist', 'fan_art']).optional(),
      subject: z.string().optional(),
      colorPreference: z.string().optional(),
      excludeElements: z.array(z.string()).optional(),
      tvShowTheme: z.string().optional(),
      tvShowElements: z.string().optional(),
    }).optional(),
    theme: z.string().optional(),
  }),
});

/**
 * GET /banners
 * List all banners
 */
router.get('/banners', async (req: AuthRequest, res, next) => {
  try {
    const position = req.query.position as BannerPosition | undefined;
    const campaignId = req.query.campaignId as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const banners = await bannerService.listBanners({ position, campaignId, isActive });
    res.json(banners);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /banners/dimensions
 * Get banner dimension requirements for all positions
 */
router.get('/banners/dimensions', async (_req: AuthRequest, res, next) => {
  try {
    res.json(BANNER_DIMENSIONS);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /banners/:id
 * Get banner by ID
 */
router.get('/banners/:id', async (req: AuthRequest, res, next) => {
  try {
    const banner = await bannerService.getBannerById(req.params.id);
    res.json(banner);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /banners
 * Create a new banner
 */
router.post(
  '/banners',
  validate(createBannerSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const banner = await bannerService.createBanner(req.body);
      res.status(201).json(banner);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /banners/:id/upload
 * Upload an image for a banner
 */
router.post(
  '/banners/:id/upload',
  upload.single('image'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('No image file provided', 400);
      }

      await validateUploadedFile(req.file.path, 'image');

      const banner = await bannerService.getBannerById(req.params.id);

      // Build public URL
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const imageUrl = `${baseUrl}/api/files/banners/${req.file.filename}`;

      const updatedBanner = await bannerService.updateBannerImage(banner.id, imageUrl, false);

      res.json({
        message: 'Image uploaded successfully',
        banner: updatedBanner,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /banners/:id
 * Update a banner
 */
router.put(
  '/banners/:id',
  validate(updateBannerSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const banner = await bannerService.updateBanner(req.params.id, req.body);
      res.json(banner);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /banners/:id
 * Delete a banner
 */
router.delete('/banners/:id', async (req: AuthRequest, res, next) => {
  try {
    await bannerService.deleteBanner(req.params.id);
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /banners/:id/toggle
 * Toggle banner active status
 */
router.post('/banners/:id/toggle', async (req: AuthRequest, res, next) => {
  try {
    const banner = await bannerService.toggleBanner(req.params.id);
    res.json(banner);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /banners/:id/generate-ai
 * Generate AI image for a banner
 */
router.post(
  '/banners/:id/generate-ai',
  validate(generateAiImageSchema),
  async (req: AuthRequest, res, next) => {
    try {
      if (!aiImageService.isAvailable()) {
        throw new AppError('AI image generation is not configured. Please set OPENAI_API_KEY.', 503);
      }

      const banner = await bannerService.getBannerById(req.params.id);
      const { customPrompt, guidedOptions, theme } = req.body;

      const result = await aiImageService.generateBannerImage(
        banner.id,
        banner.position,
        { customPrompt, guidedOptions, theme }
      );

      // Update banner with generated image
      const updatedBanner = await bannerService.updateBannerImage(
        banner.id,
        result.url,
        true,
        customPrompt || (guidedOptions ? JSON.stringify(guidedOptions) : undefined)
      );

      res.json({
        message: 'AI image generated successfully',
        banner: updatedBanner,
        image: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
