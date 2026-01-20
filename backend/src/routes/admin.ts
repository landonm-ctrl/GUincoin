import express from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import emailService from '../services/emailService';
import {
  isTemplateKey,
  listEmailTemplates,
  upsertEmailTemplate,
} from '../services/emailTemplateService';
import { upload, publicUpload, getFileUrl, getPublicFileUrl } from '../services/fileService';
import { FrequencyRule, StoreProductSource, PurchaseOrderStatus } from '@prisma/client';
import {
  fetchAmazonProductDetails,
  fetchAmazonListAsins,
} from '../services/amazonImportService';
import { normalizeStoreProduct, usdToGuincoin } from '../services/storeService';

const router = express.Router();

const getStoreProductDelegate = () => {
  const delegate = (prisma as any).storeProduct;
  if (!delegate) {
    throw new Error('StoreProduct model not available. Run prisma migrate dev and prisma generate.');
  }
  return delegate;
};

const wellnessTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  coinValue: z.coerce.number().positive(),
  frequencyRule: z.nativeEnum(FrequencyRule),
  maxRewardedUsers: z.coerce.number().int().positive().optional(),
});

const emailTemplateUpdateSchema = z.object({
  params: z.object({
    key: z.string(),
  }),
  body: z.object({
    subject: z.string().min(1),
    html: z.string().min(1),
    isEnabled: z.boolean().optional(),
  }),
});

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

// Get email templates
router.get('/email-templates', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const templates = await listEmailTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update email template
router.put(
  '/email-templates/:key',
  requireAdmin,
  validate(emailTemplateUpdateSchema),
  async (req: AuthRequest, res) => {
    try {
      const { key } = req.params;
      if (!isTemplateKey(key)) {
        return res.status(404).json({ error: 'Email template not found' });
      }

      const { subject, html, isEnabled } = req.body;
      const updated = await upsertEmailTemplate(key, { subject, html, isEnabled });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Create wellness task
router.post(
  '/wellness/tasks',
  requireAuth,
  upload.single('template'),
  async (req: AuthRequest, res) => {
    try {
      const normalizedBody = { ...req.body };
      if (normalizedBody.maxRewardedUsers === '') {
        delete normalizedBody.maxRewardedUsers;
      }

      const parsed = wellnessTaskSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid data' });
      }

      const { name, description, instructions, coinValue, frequencyRule, maxRewardedUsers } =
        parsed.data;

      const task = await prisma.wellnessTask.create({
        data: {
          name,
          description: description || null,
          instructions: instructions || null,
          coinValue,
          frequencyRule,
          requiresApproval: true,
          formTemplateUrl: req.file ? getFileUrl(req.file.filename) : null,
          maxRewardedUsers: maxRewardedUsers || null,
        },
      });

      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all wellness tasks (including inactive)
router.get('/wellness/tasks', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const tasks = await prisma.wellnessTask.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      coinValue: Number(task.coinValue),
    }));

    res.json(normalizedTasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete wellness task (set inactive to preserve data)
router.delete('/wellness/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.wellnessTask.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Wellness task not found' });
    }

    // Set isActive to false instead of deleting to preserve:
    // - Submissions and their documents
    // - Transaction records
    // - Historical data
    await prisma.wellnessTask.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Wellness task deactivated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all users with their wellness submissions
router.get('/wellness/users', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const users = await prisma.employee.findMany({
      include: {
        wellnessSubmissions: {
          include: {
            wellnessTask: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            transaction: {
              select: {
                id: true,
                status: true,
                amount: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const normalizedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      submissions: user.wellnessSubmissions.map((submission) => ({
        ...submission,
        wellnessTask: {
          ...submission.wellnessTask,
        },
        transaction: submission.transaction
          ? {
              ...submission.transaction,
              amount: Number(submission.transaction.amount),
            }
          : null,
      })),
    }));

    res.json(normalizedUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get wellness submissions for a specific user
router.get('/wellness/users/:id/submissions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const submissions = await prisma.wellnessSubmission.findMany({
      where: { employeeId: req.params.id },
      include: {
        wellnessTask: true,
        transaction: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const normalizedSubmissions = submissions.map((submission) => ({
      ...submission,
      wellnessTask: {
        ...submission.wellnessTask,
        coinValue: Number(submission.wellnessTask.coinValue),
      },
      transaction: submission.transaction
        ? {
            ...submission.transaction,
            amount: Number(submission.transaction.amount),
          }
        : null,
    }));

    res.json(normalizedSubmissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending wellness submissions
router.get('/wellness/pending', requireAuth, async (req: AuthRequest, res) => {
  try {
    const submissions = await prisma.wellnessSubmission.findMany({
      where: { status: 'pending' },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        wellnessTask: true,
        transaction: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    const normalizedSubmissions = submissions.map((submission) => ({
      ...submission,
      wellnessTask: {
        ...submission.wellnessTask,
        coinValue: Number(submission.wellnessTask.coinValue),
      },
      transaction: submission.transaction
        ? {
            ...submission.transaction,
            amount: Number(submission.transaction.amount),
          }
        : submission.transaction,
    }));

    res.json(normalizedSubmissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve wellness submission
const approveSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

router.post(
  '/wellness/:id/approve',
  requireAuth,
  validate(approveSchema),
  async (req: AuthRequest, res) => {
    try {
      const submission = await prisma.wellnessSubmission.findUnique({
        where: { id: req.params.id },
        include: {
          employee: true,
          wellnessTask: true,
          transaction: true,
        },
      });

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      if (submission.status !== 'pending') {
        return res
          .status(400)
          .json({ error: 'Submission is not pending approval' });
      }

      if (submission.wellnessTask.maxRewardedUsers) {
        const approvedCount = await prisma.wellnessSubmission.count({
          where: {
            wellnessTaskId: submission.wellnessTaskId,
            status: 'approved',
          },
        });

        if (approvedCount >= submission.wellnessTask.maxRewardedUsers) {
          await prisma.wellnessSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'rejected',
              rejectionReason: 'Maximum rewards reached for this task',
              reviewedById: req.user!.id,
              reviewedAt: new Date(),
            },
          });

          if (submission.transaction) {
            await transactionService.rejectTransaction(submission.transaction.id);
          }

          await emailService.sendWellnessRejectionNotification(
            submission.employee.email,
            submission.employee.name,
            submission.wellnessTask.name,
            'Maximum rewards reached for this task'
          );

          return res.status(400).json({ error: 'This task has reached its reward limit' });
        }
      }

      // Update submission status
      await prisma.wellnessSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'approved',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
      });

      // Post the transaction
      if (submission.transaction) {
        await transactionService.postTransaction(submission.transaction.id);
      }

      // Send approval email
      await emailService.sendWellnessApprovalNotification(
        submission.employee.email,
        submission.employee.name,
        submission.wellnessTask.name,
        Number(submission.wellnessTask.coinValue)
      );

      res.json({ message: 'Submission approved successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Reject wellness submission
const rejectSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

router.post(
  '/wellness/:id/reject',
  requireAuth,
  validate(rejectSchema),
  async (req: AuthRequest, res) => {
    try {
      const submission = await prisma.wellnessSubmission.findUnique({
        where: { id: req.params.id },
        include: {
          employee: true,
          wellnessTask: true,
          transaction: true,
        },
      });

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      if (submission.status !== 'pending') {
        return res
          .status(400)
          .json({ error: 'Submission is not pending approval' });
      }

      // Update submission status
      await prisma.wellnessSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'rejected',
          rejectionReason: req.body.reason,
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
      });

      // Reject the transaction
      if (submission.transaction) {
        await transactionService.rejectTransaction(submission.transaction.id);
      }

      // Send rejection email
      await emailService.sendWellnessRejectionNotification(
        submission.employee.email,
        submission.employee.name,
        submission.wellnessTask.name,
        req.body.reason
      );

      res.json({ message: 'Submission rejected' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Create custom store product
router.post(
  '/store/products/custom',
  requireAdmin,
  publicUpload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = customProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.issues[0]?.message || 'Invalid data' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Product image is required' });
      }

      const { name, description, coinValue } = parsed.data;
      const storeProduct = getStoreProductDelegate();
      const product = await storeProduct.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrls: [getPublicFileUrl(req.file.filename)],
          source: StoreProductSource.custom,
          priceGuincoin: coinValue,
        },
      });

      res.json(normalizeStoreProduct(product));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Seed a sample store product (admin-only helper)
router.post('/store/products/seed', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const storeProduct = getStoreProductDelegate();
    const product = await storeProduct.create({
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
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Import store product from Amazon URL
router.post(
  '/store/products/amazon',
  requireAdmin,
  validate(amazonImportSchema),
  async (req: AuthRequest, res) => {
    try {
      const { url } = req.body;
      const details = await fetchAmazonProductDetails(url);

      if (!details.title) {
        return res.status(400).json({
          error:
            'Unable to read product title from Amazon. The page might be blocked or requires login.',
        });
      }

      if (!details.priceUsd) {
        return res.status(400).json({
          error:
            'Unable to read product price from Amazon. The item might be unavailable or price is hidden.',
        });
      }

      const coinValue = usdToGuincoin(details.priceUsd);

      const storeProduct = getStoreProductDelegate();
      const existing = details.asin
        ? await storeProduct.findUnique({ where: { amazonAsin: details.asin } })
        : null;

      const product = existing
        ? await storeProduct.update({
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
        : await storeProduct.create({
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
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Import store products from Amazon list URL
router.post(
  '/store/products/amazon-list',
  requireAdmin,
  validate(amazonListImportSchema),
  async (req: AuthRequest, res) => {
    try {
      const { url, limit } = req.body;
      const maxItems = limit ?? 20;
      const asins = await fetchAmazonListAsins(url);

      if (asins.length === 0) {
        return res.status(400).json({
          error:
            'No products found on the list URL. Make sure the list is public and accessible.',
        });
      }

      const origin = new URL(url).origin;
      const results: Array<{ asin: string; status: 'imported' | 'failed'; message?: string }> = [];
      const storeProduct = getStoreProductDelegate();

      for (const asin of asins.slice(0, maxItems)) {
        try {
          const productUrl = `${origin}/dp/${asin}`;
          const details = await fetchAmazonProductDetails(productUrl);

          if (!details.title || !details.priceUsd) {
            throw new Error('Missing title or price');
          }

          const coinValue = usdToGuincoin(details.priceUsd);
          const existing = await storeProduct.findUnique({
            where: { amazonAsin: asin },
          });

          if (existing) {
            await storeProduct.update({
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
            await storeProduct.create({
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
        } catch (error: any) {
          results.push({ asin, status: 'failed', message: error.message });
        }
      }

      res.json({
        requested: Math.min(asins.length, maxItems),
        totalFound: asins.length,
        results,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all pending purchase orders
router.get('/purchases/pending', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const purchases = await prisma.storePurchaseOrder.findMany({
      where: { status: PurchaseOrderStatus.pending },
      include: {
        product: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      purchases.map((p) => ({
        ...p,
        product: normalizeStoreProduct(p.product),
        priceGuincoin: Number(p.product.priceGuincoin),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all purchases (all statuses)
router.get('/purchases', requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as PurchaseOrderStatus | undefined;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const purchases = await prisma.storePurchaseOrder.findMany({
      where,
      include: {
        product: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fulfilledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      purchases.map((p) => ({
        ...p,
        product: normalizeStoreProduct(p.product),
        priceGuincoin: Number(p.product.priceGuincoin),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fulfill a purchase order
const fulfillPurchaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    trackingNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
});

router.post(
  '/purchases/:id/fulfill',
  requireAuth,
  validate(fulfillPurchaseSchema),
  async (req: AuthRequest, res) => {
    try {
      const purchase = await prisma.storePurchaseOrder.findUnique({
        where: { id: req.params.id },
        include: {
          product: true,
          employee: true,
        },
      });

      if (!purchase) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      if (purchase.status !== PurchaseOrderStatus.pending) {
        return res.status(400).json({ error: 'Purchase order is not pending' });
      }

      const updated = await prisma.storePurchaseOrder.update({
        where: { id: req.params.id },
        data: {
          status: PurchaseOrderStatus.fulfilled,
          fulfilledById: req.user!.id,
          fulfilledAt: new Date(),
          trackingNumber: req.body.trackingNumber || null,
          notes: req.body.notes || null,
        },
        include: {
          product: true,
          employee: true,
        },
      });

      // Send email notification
      await emailService.sendPurchaseFulfilledNotification(
        purchase.employee.email,
        purchase.employee.name,
        purchase.product.name,
        req.body.trackingNumber
      );

      res.json({
        purchaseOrder: {
          ...updated,
          product: normalizeStoreProduct(updated.product),
          priceGuincoin: Number(updated.product.priceGuincoin),
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
