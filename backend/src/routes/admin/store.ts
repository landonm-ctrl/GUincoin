import express from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import prisma from '../../config/database';
import { publicUpload, getPublicFileUrl } from '../../services/fileService';
import { StoreProductSource } from '@prisma/client';
import {
  fetchAmazonProductDetails,
  fetchAmazonListAsins,
} from '../../services/amazonImportService';
import { normalizeStoreProduct, usdToGuincoin } from '../../services/storeService';
import { AppError } from '../../utils/errors';

const router = express.Router();

const customProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  coinValue: z.coerce.number().positive(),
});

const amazonImportSchema = z.object({
  body: z.object({
    url: z.string().url(),
  }),
});

const amazonListImportSchema = z.object({
  body: z.object({
    url: z.string().url(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

// Create custom store product
router.post(
  '/store/products/custom',
  publicUpload.single('image'),
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = customProductSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message || 'Invalid data', 400);
      }

      if (!req.file) {
        throw new AppError('Product image is required', 400);
      }

      const { name, description, coinValue } = parsed.data;
      const product = await prisma.storeProduct.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrls: [getPublicFileUrl(req.file.filename)],
          source: StoreProductSource.custom,
          priceGuincoin: coinValue,
        },
      });

      res.json(normalizeStoreProduct(product));
    } catch (error) {
      next(error);
    }
  }
);

// Seed a sample store product
router.post('/store/products/seed', async (_req: AuthRequest, res, next) => {
  try {
    const product = await prisma.storeProduct.create({
      data: {
        name: 'Sample Store Item',
        description: 'Sample product created for testing the store page.',
        imageUrls: ['https://placehold.co/600x400/png?text=Guincoin+Store'],
        source: StoreProductSource.custom,
        priceGuincoin: 25,
        isActive: true,
      },
    });

    res.json(normalizeStoreProduct(product));
  } catch (error) {
    next(error);
  }
});

// Import store product from Amazon URL
router.post(
  '/store/products/amazon',
  validate(amazonImportSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { url } = req.body;
      const details = await fetchAmazonProductDetails(url);

      if (!details.title) {
        throw new AppError(
          'Unable to read product title from Amazon. The page might be blocked or requires login.',
          400
        );
      }

      if (!details.priceUsd) {
        throw new AppError(
          'Unable to read product price from Amazon. The item might be unavailable or price is hidden.',
          400
        );
      }

      const coinValue = usdToGuincoin(details.priceUsd);
      const existing = details.asin
        ? await prisma.storeProduct.findUnique({ where: { amazonAsin: details.asin } })
        : null;

      const product = existing
        ? await prisma.storeProduct.update({
            where: { id: existing.id },
            data: {
              name: details.title,
              description: details.description,
              imageUrls: details.imageUrls,
              amazonUrl: details.url,
              priceUsd: details.priceUsd,
              priceGuincoin: coinValue,
              source: StoreProductSource.amazon,
              isActive: true,
            },
          })
        : await prisma.storeProduct.create({
            data: {
              name: details.title,
              description: details.description,
              imageUrls: details.imageUrls,
              amazonUrl: details.url,
              amazonAsin: details.asin,
              source: StoreProductSource.amazon,
              priceUsd: details.priceUsd,
              priceGuincoin: coinValue,
            },
          });

      res.json(normalizeStoreProduct(product));
    } catch (error) {
      next(error);
    }
  }
);

// Import store products from Amazon list URL
router.post(
  '/store/products/amazon-list',
  validate(amazonListImportSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { url, limit } = req.body;
      const maxItems = limit ?? 20;
      const asins = await fetchAmazonListAsins(url);

      if (asins.length === 0) {
        throw new AppError(
          'No products found on the list URL. Make sure the list is public and accessible.',
          400
        );
      }

      const origin = new URL(url).origin;
      const results: Array<{ asin: string; status: 'imported' | 'failed'; message?: string }> = [];

      for (const asin of asins.slice(0, maxItems)) {
        try {
          const productUrl = `${origin}/dp/${asin}`;
          const details = await fetchAmazonProductDetails(productUrl);

          if (!details.title || !details.priceUsd) {
            throw new Error('Missing title or price');
          }

          const coinValue = usdToGuincoin(details.priceUsd);
          const existing = await prisma.storeProduct.findUnique({
            where: { amazonAsin: asin },
          });

          if (existing) {
            await prisma.storeProduct.update({
              where: { id: existing.id },
              data: {
                name: details.title,
                description: details.description,
                imageUrls: details.imageUrls,
                amazonUrl: details.url,
                priceUsd: details.priceUsd,
                priceGuincoin: coinValue,
                source: StoreProductSource.amazon_list,
                isActive: true,
              },
            });
          } else {
            await prisma.storeProduct.create({
              data: {
                name: details.title,
                description: details.description,
                imageUrls: details.imageUrls,
                amazonUrl: details.url,
                amazonAsin: asin,
                source: StoreProductSource.amazon_list,
                priceUsd: details.priceUsd,
                priceGuincoin: coinValue,
              },
            });
          }

          results.push({ asin, status: 'imported' });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.push({ asin, status: 'failed', message });
        }
      }

      res.json({
        requested: Math.min(asins.length, maxItems),
        totalFound: asins.length,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all store products (for admin management)
router.get('/store/products', async (_req: AuthRequest, res, next) => {
  try {
    const products = await prisma.storeProduct.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(products.map(normalizeStoreProduct));
  } catch (error) {
    next(error);
  }
});

// Toggle product active status (soft delete/restore)
router.patch(
  '/store/products/:id/toggle',
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const product = await prisma.storeProduct.findUnique({
        where: { id },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const updated = await prisma.storeProduct.update({
        where: { id },
        data: { isActive: !product.isActive },
      });

      res.json({
        message: updated.isActive ? 'Product activated' : 'Product deactivated',
        product: normalizeStoreProduct(updated),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a store product permanently
router.delete(
  '/store/products/:id',
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const product = await prisma.storeProduct.findUnique({
        where: { id },
        include: {
          purchases: { take: 1 },
          goals: { take: 1 },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Check if product has associated purchases or goals
      if (product.purchases.length > 0 || product.goals.length > 0) {
        // Soft delete instead - just deactivate it
        const updated = await prisma.storeProduct.update({
          where: { id },
          data: { isActive: false },
        });

        return res.json({
          message: 'Product has purchase history and was deactivated instead of deleted',
          product: normalizeStoreProduct(updated),
          softDeleted: true,
        });
      }

      // Hard delete if no purchases or goals
      await prisma.storeProduct.delete({
        where: { id },
      });

      res.json({
        message: 'Product deleted successfully',
        id,
        softDeleted: false,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
