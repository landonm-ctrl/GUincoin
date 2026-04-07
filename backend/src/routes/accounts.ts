import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import { wrapAsync } from '../utils/wrapAsync';
import { AppError } from '../utils/errors';

const router = express.Router();

// Get account balance
router.get('/balance', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.id },
    include: { account: true },
  });

  if (!employee || !employee.account) {
    throw new AppError('Account not found', 404);
  }

  const balance = await transactionService.getAccountBalance(
    employee.account.id,
    true
  );

  res.json(balance);
}));

// Get transaction history
const transactionHistorySchema = z.object({
  query: z.object({
    limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
    offset: z.string().optional().transform((val) => (val ? parseInt(val) : 0)),
    status: z.enum(['pending', 'posted', 'rejected']).optional(),
    transactionType: z
      .enum([
        'manager_award',
        'peer_transfer_sent',
        'peer_transfer_received',
        'wellness_reward',
        'adjustment',
      ])
      .optional(),
  }),
});

router.get(
  '/transactions',
  requireAuth,
  validate(transactionHistorySchema),
  wrapAsync(async (req: AuthRequest, res) => {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      include: { account: true },
    });

    if (!employee || !employee.account) {
      throw new AppError('Account not found', 404);
    }

    const history = await transactionService.getTransactionHistory(
      employee.account.id,
      {
        limit: Number(req.query.limit) || 20,
        offset: Number(req.query.offset) || 0,
        status: req.query.status as any,
        transactionType: req.query.transactionType as any,
      }
    );

    res.json(history);
  })
);

// Get pending transactions
router.get('/pending', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.id },
    include: { account: true },
  });

  if (!employee || !employee.account) {
    throw new AppError('Account not found', 404);
  }

  const pending = await transactionService.getPendingTransactions(
    employee.account.id
  );

  res.json(pending);
}));

export default router;
