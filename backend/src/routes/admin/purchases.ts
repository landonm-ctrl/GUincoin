import express from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import prisma from '../../config/database';
import emailService from '../../services/emailService';
import { PurchaseOrderStatus } from '@prisma/client';
import { normalizeStoreProduct } from '../../services/storeService';
import { AppError } from '../../utils/errors';
import { toNumber } from '../../utils/number';

const router = express.Router();

// Get all pending purchase orders
router.get('/purchases/pending', async (_req: AuthRequest, res, next) => {
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
        priceGuincoin: toNumber(p.product.priceGuincoin),
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Get all purchases (all statuses)
router.get('/purchases', async (req: AuthRequest, res, next) => {
  try {
    const status = req.query.status as PurchaseOrderStatus | undefined;
    const where: Record<string, unknown> = {};
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
        priceGuincoin: toNumber(p.product.priceGuincoin),
      }))
    );
  } catch (error) {
    next(error);
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
  validate(fulfillPurchaseSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const purchase = await prisma.storePurchaseOrder.findUnique({
        where: { id: req.params.id },
        include: {
          product: true,
          employee: true,
        },
      });

      if (!purchase) {
        throw new AppError('Purchase order not found', 404);
      }

      if (purchase.status !== PurchaseOrderStatus.pending) {
        throw new AppError('Purchase order is not pending', 400);
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
          priceGuincoin: toNumber(updated.product.priceGuincoin),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
