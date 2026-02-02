import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';

const router = express.Router();

// Get account balance
router.get('/balance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      include: { account: true },
    });

    if (!employee || !employee.account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const balance = await transactionService.getAccountBalance(
      employee.account.id,
      true
    );

    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
  async (req: AuthRequest, res) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: req.user!.id },
        include: { account: true },
      });

      if (!employee || !employee.account) {
        return res.status(404).json({ error: 'Account not found' });
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get pending transactions
router.get('/pending', requireAuth, async (req: AuthRequest, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      include: { account: true },
    });

    if (!employee || !employee.account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const pending = await transactionService.getPendingTransactions(
      employee.account.id
    );

    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
