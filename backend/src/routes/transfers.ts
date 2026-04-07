import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import emailService from '../services/emailService';
import pendingTransferService from '../services/pendingTransferService';
import { PeriodType } from '@prisma/client';
import { wrapAsync } from '../utils/wrapAsync';
import { AppError } from '../utils/errors';

const router = express.Router();

// Get transfer limits
router.get('/limits', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
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
}));

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
  wrapAsync(async (req: AuthRequest, res) => {
    const { recipientEmail, amount, message } = req.body;
    const normalizedRecipientEmail = recipientEmail.toLowerCase();

    // Check if sending to self
    if (normalizedRecipientEmail === req.user!.email.toLowerCase()) {
      throw new AppError('Cannot send coins to yourself', 400);
    }

    // Get sender
    const sender = await prisma.employee.findUnique({
      where: { id: req.user!.id },
    });

    if (!sender) {
      throw new AppError('Employee not found', 404);
    }

    // Get sender account
    const senderAccount = await prisma.account.findUnique({
      where: { employeeId: sender.id },
    });

    if (!senderAccount) {
      throw new AppError('Account not found', 404);
    }

    // Check balance (include pending to prevent over-committing)
    const balance = await transactionService.getAccountBalance(
      senderAccount.id,
      true
    );
    if (balance.total < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    // Check transfer limits
    const limits = await prisma.peerTransferLimit.findFirst({
      where: {
        employeeId: req.user!.id,
        periodType: PeriodType.monthly,
        periodStart: { lte: new Date() },
        periodEnd: { gte: new Date() },
      },
    });

    if (limits) {
      const usedAmount = await prisma.ledgerTransaction.aggregate({
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
        throw new AppError('Transfer limit exceeded', 400);
      }
    }

    // Get recipient
    const recipient = await prisma.employee.findUnique({
      where: { email: normalizedRecipientEmail },
      include: { account: true },
    });

    if (!recipient) {
      const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN;
      if (workspaceDomain && !normalizedRecipientEmail.endsWith('@' + workspaceDomain)) {
        throw new AppError('Recipient email is not eligible', 400);
      }

      const pending = await pendingTransferService.createPendingTransfer({
        senderEmployeeId: sender.id,
        senderAccountId: senderAccount.id,
        recipientEmail: normalizedRecipientEmail,
        amount,
        message,
        recipientNameFallback: normalizedRecipientEmail,
        senderName: sender.name,
      });

      res.status(202).json({
        message: 'Transfer pending until recipient signs in',
        pendingTransfer: pending.pendingTransfer,
      });
      return;
    }

    if (!recipient.account) {
      throw new AppError('Recipient account not found', 404);
    }

    // Create transactions (sent and received)
    const sentTransaction = await transactionService.createPendingTransaction(
      senderAccount.id,
      'peer_transfer_sent',
      amount,
      message || `Transfer to ${recipient.name}`,
      req.user!.id
    );

    const receivedTransaction =
      await transactionService.createPendingTransaction(
        recipient.account.id,
        'peer_transfer_received',
        amount,
        message || `Transfer from ${sender.name}`,
        req.user!.id,
        recipient.id
      );

    // Post both transactions immediately
    await transactionService.postTransaction(sentTransaction.id);
    await transactionService.postTransaction(receivedTransaction.id);

    // Send email notification
    await emailService.sendPeerTransferNotification(
      recipient.email,
      recipient.name,
      sender.name,
      amount,
      message
    );

    await emailService.sendPeerTransferSentNotification(
      sender.email,
      sender.name,
      recipient.name,
      amount,
      message
    );

    res.json({
      message: 'Transfer completed successfully',
      transaction: sentTransaction,
    });
  })
);

// Get transfer history
router.get('/history', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.id },
  });

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  const account = await prisma.account.findUnique({
    where: { employeeId: employee.id },
  });

  if (!account) {
    throw new AppError('Account not found', 404);
  }

  const history = await transactionService.getTransactionHistory(
    account.id,
    {
      transactionType: 'peer_transfer_sent',
    }
  );

  res.json(history);
}));

// Get pending transfers
router.get('/pending', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const pendingTransfers = await prisma.pendingTransfer.findMany({
    where: {
      senderEmployeeId: req.user!.id,
      status: 'pending',
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(pendingTransfers);
}));

// Cancel a pending transfer
router.post('/:transferId/cancel', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const { transferId } = req.params;

  const cancelledTransfer = await pendingTransferService.cancelPendingTransfer(
    transferId,
    req.user!.id
  );

  res.json({
    message: 'Transfer cancelled successfully',
    transfer: cancelledTransfer,
  });
}));

export default router;
