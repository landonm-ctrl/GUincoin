import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import emailService from '../services/emailService';
import pendingTransferService from '../services/pendingTransferService';
import { PeriodType } from '@prisma/client';

const router = express.Router();

// Get transfer limits
router.get('/limits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    let limit = await prisma.peerTransferLimit.findFirst({
      where: {
        employeeId: req.user!.id,
        periodType: PeriodType.monthly,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    // Default limit if none exists
    if (!limit) {
      const defaultLimit = 500; // Can be made configurable
      limit = await prisma.peerTransferLimit.create({
        data: {
          employeeId: req.user!.id,
          periodType: PeriodType.monthly,
          maxAmount: defaultLimit,
          periodStart,
          periodEnd,
        },
      });
    }

    // Calculate used amount
    const usedAmount = await prisma.ledgerTransaction.aggregate({
      where: {
        sourceEmployeeId: req.user!.id,
        transactionType: 'peer_transfer_sent',
        status: 'posted',
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    res.json({
      ...limit,
      usedAmount: Number(usedAmount._sum.amount || 0),
      remaining:
        Number(limit.maxAmount) - Number(usedAmount._sum.amount || 0),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send coins to peer
const sendTransferSchema = z.object({
  body: z.object({
    recipientEmail: z.string().email(),
    amount: z.number().positive(),
    message: z.string().optional(),
  }),
});

router.post(
  '/send',
  requireAuth,
  validate(sendTransferSchema),
  async (req: AuthRequest, res) => {
    try {
      const { recipientEmail, amount, message } = req.body;
      const normalizedRecipientEmail = recipientEmail.toLowerCase();

      // Check if sending to self
      if (normalizedRecipientEmail === req.user!.email.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot send coins to yourself' });
      }

      // Get sender
      const sender = await prisma.employee.findUnique({
        where: { id: req.user!.id },
      });

      if (!sender) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      // Get sender account
      const senderAccount = await prisma.account.findUnique({
        where: { employeeId: sender.id },
      });

      if (!senderAccount) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Wrap core logic in a database transaction to prevent double-spend
      const result = await prisma.$transaction(async (tx) => {
        // Check balance with FOR UPDATE lock to prevent concurrent reads
        const balance = await transactionService.getAccountBalanceForUpdate(
          senderAccount.id,
          tx
        );
        if (balance.total < amount) {
          throw new Error('Insufficient balance');
        }

        // Check transfer limits
        const limits = await tx.peerTransferLimit.findFirst({
          where: {
            employeeId: req.user!.id,
            periodType: PeriodType.monthly,
            periodStart: { lte: new Date() },
            periodEnd: { gte: new Date() },
          },
        });

        if (limits) {
          const usedAmount = await tx.ledgerTransaction.aggregate({
            where: {
              sourceEmployeeId: req.user!.id,
              transactionType: 'peer_transfer_sent',
              status: { in: ['posted', 'pending'] },
              createdAt: {
                gte: limits.periodStart,
                lte: limits.periodEnd,
              },
            },
            _sum: {
              amount: true,
            },
          });

          const used = Number(usedAmount._sum.amount || 0);
          if (used + amount > Number(limits.maxAmount)) {
            throw new Error('Transfer limit exceeded');
          }
        }

        // Get recipient
        const recipient = await tx.employee.findUnique({
          where: { email: normalizedRecipientEmail },
          include: { account: true },
        });

        if (!recipient) {
          const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN;
          if (workspaceDomain && !normalizedRecipientEmail.endsWith(workspaceDomain)) {
            throw new Error('Recipient email is not eligible');
          }

          const pending = await pendingTransferService.createPendingTransfer({
            senderEmployeeId: sender.id,
            senderAccountId: senderAccount.id,
            recipientEmail: normalizedRecipientEmail,
            amount,
            message,
            recipientNameFallback: normalizedRecipientEmail,
            senderName: sender.name,
          }, tx);

          return {
            type: 'pending' as const,
            pendingTransfer: pending.pendingTransfer,
          };
        }

        if (!recipient.account) {
          throw new Error('Recipient account not found');
        }

        // Create transactions (sent and received)
        const sentTransaction = await transactionService.createPendingTransaction(
          senderAccount.id,
          'peer_transfer_sent',
          amount,
          message || `Transfer to ${recipient.name}`,
          req.user!.id,
          undefined,
          undefined,
          tx
        );

        const receivedTransaction =
          await transactionService.createPendingTransaction(
            recipient.account.id,
            'peer_transfer_received',
            amount,
            message || `Transfer from ${sender.name}`,
            req.user!.id,
            recipient.id,
            undefined,
            tx
          );

        // Post both transactions immediately
        await transactionService.postTransaction(sentTransaction.id, tx);
        await transactionService.postTransaction(receivedTransaction.id, tx);

        return {
          type: 'completed' as const,
          transaction: sentTransaction,
          recipient,
        };
      });

      // Send emails OUTSIDE the transaction (after commit)
      if (result.type === 'pending') {
        return res.status(202).json({
          message: 'Transfer pending until recipient signs in',
          pendingTransfer: result.pendingTransfer,
        });
      }

      // Send email notifications after successful commit
      await emailService.sendPeerTransferNotification(
        result.recipient.email,
        result.recipient.name,
        sender.name,
        amount,
        message
      );

      await emailService.sendPeerTransferSentNotification(
        sender.email,
        sender.name,
        result.recipient.name,
        amount,
        message
      );

      res.json({
        message: 'Transfer completed successfully',
        transaction: result.transaction,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get transfer history
router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const account = await prisma.account.findUnique({
      where: { employeeId: employee.id },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const history = await transactionService.getTransactionHistory(
      account.id,
      {
        transactionType: 'peer_transfer_sent',
      }
    );

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending transfers
router.get('/pending', requireAuth, async (req: AuthRequest, res) => {
  try {
    const pendingTransfers = await prisma.pendingTransfer.findMany({
      where: {
        senderEmployeeId: req.user!.id,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pendingTransfers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a pending transfer
router.post('/:transferId/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { transferId } = req.params;

    const cancelledTransfer = await pendingTransferService.cancelPendingTransfer(
      transferId,
      req.user!.id
    );

    res.json({
      message: 'Transfer cancelled successfully',
      transfer: cancelledTransfer,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
