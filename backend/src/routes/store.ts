import express from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { normalizeStoreProduct } from '../services/storeService';
import transactionService from '../services/transactionService';
import { TransactionType, PurchaseOrderStatus } from '@prisma/client';
import { validate } from '../middleware/validation';

const router = express.Router();

const AMAZON_HOST_HINTS = ['amazon.', 'media-amazon', 'ssl-images-amazon', 'images-na.ssl-images-amazon'];

const isAmazonImageUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (
      AMAZON_HOST_HINTS.some((hint) => host.includes(hint)) ||
      host.endsWith('amazonaws.com')
    );
  } catch {
    return false;
  }
};

const getProxyBaseUrl = (req: AuthRequest): string =>
  process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

const toAmazonProxyUrl = (req: AuthRequest, imageUrl: string): string =>
  `${getProxyBaseUrl(req)}/api/store/amazon-image?url=${encodeURIComponent(imageUrl)}`;

const withTimeout = async (url: string, timeoutMs = 8_000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GuincoinStoreImageProxy/1.0',
        Accept: 'image/*,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const getStoreProductDelegate = () => {
  const delegate = (prisma as any).storeProduct;
  if (!delegate) {
    throw new Error('StoreProduct model not available. Run prisma migrate dev and prisma generate.');
  }
  return delegate;
};

// Get available store products
router.get('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeProduct = getStoreProductDelegate();
    const products = await storeProduct.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const normalized = products.map(normalizeStoreProduct);
    const response = normalized.map((product: any) => ({
      ...product,
      imageUrls: product.imageUrls.map((url: string) =>
        isAmazonImageUrl(url) ? toAmazonProxyUrl(req, url) : url
      ),
    }));
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy Amazon images to avoid hotlink blocking
router.get('/amazon-image', requireAuth, async (req: AuthRequest, res) => {
  try {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url || !isAmazonImageUrl(url)) {
      return res.status(400).json({ error: 'Invalid Amazon image URL' });
    }

    let response: Response;
    try {
      response = await withTimeout(url);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return res.status(504).json({ error: 'Amazon image request timed out' });
      }
      return res.status(502).json({ error: 'Amazon image request failed' });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Amazon image request failed' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase a product
const purchaseSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    shippingAddress: z.string().optional(),
  }),
});

router.post('/purchase', requireAuth, validate(purchaseSchema), async (req: AuthRequest, res) => {
  try {
    const storeProduct = getStoreProductDelegate();
    const product = await storeProduct.findUnique({
      where: { id: req.body.productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isActive) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    const employeeId = req.user!.id;
    const account = await prisma.account.findUnique({
      where: { employeeId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check balance
    const balance = await transactionService.getAccountBalance(account.id, true);
    if (balance.total < Number(product.priceGuincoin)) {
      return res.status(400).json({
        error: 'Insufficient balance',
        required: Number(product.priceGuincoin),
        available: balance.total,
      });
    }

    // Create transaction and purchase order
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.ledgerTransaction.create({
        data: {
          accountId: account.id,
          transactionType: TransactionType.store_purchase,
          amount: product.priceGuincoin,
          status: 'pending',
          description: `Purchase: ${product.name}`,
        },
      });

      // Post transaction immediately (deduct balance)
      await transactionService.postTransaction(transaction.id, tx);

      // Create purchase order
      const purchaseOrder = await tx.storePurchaseOrder.create({
        data: {
          employeeId,
          productId: product.id,
          transactionId: transaction.id,
          status: PurchaseOrderStatus.pending,
          shippingAddress: req.body.shippingAddress || null,
        },
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
      });

      // Update goal progress if user has a goal for this product
      await tx.goal.updateMany({
        where: {
          employeeId,
          productId: product.id,
          isAchieved: false,
        },
        data: {
          currentAmount: {
            increment: product.priceGuincoin,
          },
        },
      });

      // Check if any goals were achieved
      const updatedGoals = await tx.goal.findMany({
        where: {
          employeeId,
          productId: product.id,
          isAchieved: false,
        },
      });

      for (const goal of updatedGoals) {
        if (Number(goal.currentAmount) >= Number(goal.targetAmount)) {
          await tx.goal.update({
            where: { id: goal.id },
            data: {
              isAchieved: true,
              achievedAt: new Date(),
            },
          });
        }
      }

      return purchaseOrder;
    });

    const newBalance = await transactionService.getAccountBalance(account.id, true);

    res.json({
      purchaseOrder: {
        ...result,
        product: normalizeStoreProduct(result.product),
        priceGuincoin: Number(result.product.priceGuincoin),
      },
      newBalance,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's purchases
router.get('/purchases', requireAuth, async (req: AuthRequest, res) => {
  try {
    const purchases = await prisma.storePurchaseOrder.findMany({
      where: { employeeId: req.user!.id },
      include: {
        product: true,
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

// Wishlist routes
router.post('/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeProduct = getStoreProductDelegate();
    const product = await storeProduct.findUnique({
      where: { id: req.params.productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const wishlistItem = await prisma.wishlistItem.upsert({
      where: {
        employeeId_productId: {
          employeeId: req.user!.id,
          productId: product.id,
        },
      },
      create: {
        employeeId: req.user!.id,
        productId: product.id,
      },
      update: {},
      include: {
        product: true,
      },
    });

    res.json({
      wishlistItem: {
        ...wishlistItem,
        product: normalizeStoreProduct(wishlistItem.product),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.wishlistItem.delete({
      where: {
        employeeId_productId: {
          employeeId: req.user!.id,
          productId: req.params.productId,
        },
      },
    });

    res.json({ message: 'Removed from wishlist' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Item not in wishlist' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { employeeId: req.user!.id },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      wishlistItems.map((item) => ({
        ...item,
        product: normalizeStoreProduct(item.product),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Goals routes
router.post('/goals', requireAuth, validate(z.object({
  body: z.object({
    productId: z.string().uuid(),
    targetAmount: z.coerce.number().positive(),
  }),
})), async (req: AuthRequest, res) => {
  try {
    const storeProduct = getStoreProductDelegate();
    const product = await storeProduct.findUnique({
      where: { id: req.body.productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const targetAmount = req.body.targetAmount;
    if (targetAmount > Number(product.priceGuincoin)) {
      return res.status(400).json({
        error: 'Target amount cannot exceed product price',
        maxAmount: Number(product.priceGuincoin),
      });
    }

    // Check if goal already exists
    const existing = await prisma.goal.findFirst({
      where: {
        employeeId: req.user!.id,
        productId: product.id,
        isAchieved: false,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'You already have an active goal for this product' });
    }

    const account = await prisma.account.findUnique({
      where: { employeeId: req.user!.id },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const balance = await transactionService.getAccountBalance(account.id, true);
    const currentAmount = Math.min(balance.total, targetAmount);

    const goal = await prisma.goal.create({
      data: {
        employeeId: req.user!.id,
        productId: product.id,
        targetAmount,
        currentAmount,
        isAchieved: currentAmount >= targetAmount,
        achievedAt: currentAmount >= targetAmount ? new Date() : null,
      },
      include: {
        product: true,
      },
    });

    res.json({
      goal: {
        ...goal,
        product: normalizeStoreProduct(goal.product),
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/goals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { employeeId: req.user!.id },
      include: {
        product: true,
      },
      orderBy: [
        { isAchieved: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(
      goals.map((goal) => ({
        ...goal,
        product: normalizeStoreProduct(goal.product),
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/goals/:goalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.goalId },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (goal.employeeId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.goal.delete({
      where: { id: req.params.goalId },
    });

    res.json({ message: 'Goal deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check for newly achieved goals (called on login/dashboard load)
router.get('/goals/check-achievements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { employeeId: req.user!.id },
    });

    if (!account) {
      return res.json({ hasNewAchievements: false, goals: [] });
    }

    const balance = await transactionService.getAccountBalance(account.id, true);

    // Update all unachieved goals with current balance
    await prisma.goal.updateMany({
      where: {
        employeeId: req.user!.id,
        isAchieved: false,
      },
      data: {
        currentAmount: balance.total,
      },
    });

    // Find goals that just became achieved
    const newlyAchieved = await prisma.goal.findMany({
      where: {
        employeeId: req.user!.id,
        isAchieved: false,
        currentAmount: {
          gte: prisma.goal.fields.targetAmount,
        },
      },
      include: {
        product: true,
      },
    });

    // Mark them as achieved
    for (const goal of newlyAchieved) {
      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          isAchieved: true,
          achievedAt: new Date(),
        },
      });
    }

    res.json({
      hasNewAchievements: newlyAchieved.length > 0,
      goals: newlyAchieved.map((g) => ({
        ...g,
        product: normalizeStoreProduct(g.product),
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
