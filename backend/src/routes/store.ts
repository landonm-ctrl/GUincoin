import express from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { normalizeStoreProduct } from '../services/storeService';
import transactionService from '../services/transactionService';
import { TransactionType, PurchaseOrderStatus } from '@prisma/client';
import { validate } from '../middleware/validation';
import { wrapAsync } from '../utils/wrapAsync';
import { AppError } from '../utils/errors';

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
router.get('/products', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
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
}));

// Proxy Amazon images to avoid hotlink blocking
router.get('/amazon-image', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url || !isAmazonImageUrl(url)) {
    throw new AppError('Invalid Amazon image URL', 400);
  }

  let response: Response;
  try {
    response = await withTimeout(url);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AppError('Amazon image request timed out', 504);
    }
    throw new AppError('Amazon image request failed', 502);
  }

  if (!response.ok) {
    throw new AppError('Amazon image request failed', response.status);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buffer);
}));

// Purchase a product
const purchaseSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    shippingAddress: z.string().optional(),
  }),
});

router.post('/purchase', requireAuth, validate(purchaseSchema), wrapAsync(async (req: AuthRequest, res) => {
  const storeProduct = getStoreProductDelegate();
  const product = await storeProduct.findUnique({
    where: { id: req.body.productId },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (!product.isActive) {
    throw new AppError('Product is not available', 400);
  }

  const employeeId = req.user!.id;
  const account = await prisma.account.findUnique({
    where: { employeeId },
  });

  if (!account) {
    throw new AppError('Account not found', 404);
  }

  // Check balance
  const balance = await transactionService.getAccountBalance(account.id, true);
  if (balance.total < Number(product.priceGuincoin)) {
    throw new AppError('Insufficient balance', 400);
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
}));

// Get user's purchases
router.get('/purchases', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
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
}));

// Wishlist routes
router.post('/wishlist/:productId', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const storeProduct = getStoreProductDelegate();
  const product = await storeProduct.findUnique({
    where: { id: req.params.productId },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
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
}));

router.delete('/wishlist/:productId', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  await prisma.wishlistItem.delete({
    where: {
      employeeId_productId: {
        employeeId: req.user!.id,
        productId: req.params.productId,
      },
    },
  });

  res.json({ message: 'Removed from wishlist' });
}));

router.get('/wishlist', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
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
}));

// Goals routes
router.post('/goals', requireAuth, validate(z.object({
  body: z.object({
    productId: z.string().uuid(),
    targetAmount: z.coerce.number().positive(),
  }),
})), wrapAsync(async (req: AuthRequest, res) => {
  const storeProduct = getStoreProductDelegate();
  const product = await storeProduct.findUnique({
    where: { id: req.body.productId },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const targetAmount = req.body.targetAmount;
  if (targetAmount > Number(product.priceGuincoin)) {
    throw new AppError('Target amount cannot exceed product price', 400);
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
    throw new AppError('You already have an active goal for this product', 400);
  }

  const account = await prisma.account.findUnique({
    where: { employeeId: req.user!.id },
  });

  if (!account) {
    throw new AppError('Account not found', 404);
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
}));

router.get('/goals', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
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
}));

router.delete('/goals/:goalId', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.goalId },
  });

  if (!goal) {
    throw new AppError('Goal not found', 404);
  }

  if (goal.employeeId !== req.user!.id) {
    throw new AppError('Not authorized', 403);
  }

  await prisma.goal.delete({
    where: { id: req.params.goalId },
  });

  res.json({ message: 'Goal deleted' });
}));

// Check for newly achieved goals (called on login/dashboard load)
router.get('/goals/check-achievements', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const account = await prisma.account.findUnique({
    where: { employeeId: req.user!.id },
  });

  if (!account) {
    res.json({ hasNewAchievements: false, goals: [] });
    return;
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
}));

export default router;
