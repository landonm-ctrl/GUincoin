import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import transactionService from './transactionService';
import emailService from './emailService';

export class PendingTransferService {
  async createPendingTransfer(params: {
    senderEmployeeId: string;
    senderAccountId: string;
    recipientEmail: string;
    amount: number;
    message?: string;
    recipientNameFallback: string;
    senderName: string;
  }, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const normalizedEmail = params.recipientEmail.toLowerCase();

    const senderTransaction = await transactionService.createPendingTransaction(
      params.senderAccountId,
      'peer_transfer_sent',
      params.amount,
      params.message || `Transfer to ${params.recipientNameFallback}`,
      params.senderEmployeeId,
      undefined,
      undefined,
      tx
    );

    const pendingTransfer = await client.pendingTransfer.create({
      data: {
        senderEmployeeId: params.senderEmployeeId,
        recipientEmail: normalizedEmail,
        amount: params.amount,
        message: params.message,
        senderTransactionId: senderTransaction.id,
      },
    });

    // Send email outside of any transaction context — fire and forget after DB work
    await emailService.sendPeerTransferRecipientNotFoundNotification(
      normalizedEmail,
      params.recipientNameFallback,
      params.senderName,
      params.amount,
      params.message
    );

    return { pendingTransfer, senderTransaction };
  }

  async claimPendingTransfers(recipientEmail: string) {
    const normalizedEmail = recipientEmail.toLowerCase();
    const recipient = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
      include: { account: true },
    });

    if (!recipient || !recipient.account) {
      return [];
    }

    const pendingTransfers = await prisma.pendingTransfer.findMany({
      where: {
        recipientEmail: normalizedEmail,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
    });

    const claimedTransfers = [];

    for (const transfer of pendingTransfers) {
      try {
        // Each claim wrapped in its own transaction with FOR UPDATE locking
        const { sender } = await prisma.$transaction(async (tx) => {
          // Lock the recipient account row to prevent concurrent claims
          await tx.$queryRaw`
            SELECT balance FROM "Account" WHERE id = ${recipient.account!.id} FOR UPDATE
          `;

          const claimSender = await tx.employee.findUnique({
            where: { id: transfer.senderEmployeeId },
          });

          const recipientTransaction = await transactionService.createPendingTransaction(
            recipient.account!.id,
            'peer_transfer_received',
            Number(transfer.amount),
            transfer.message || `Transfer from ${claimSender?.name || 'Guincoin user'}`,
            transfer.senderEmployeeId,
            recipient.id,
            undefined,
            tx
          );

          const senderTransaction = await tx.ledgerTransaction.findUnique({
            where: { id: transfer.senderTransactionId },
          });

          if (senderTransaction?.status === 'pending') {
            await transactionService.postTransaction(senderTransaction.id, tx);
          }

          await transactionService.postTransaction(recipientTransaction.id, tx);

          await tx.pendingTransfer.update({
            where: { id: transfer.id },
            data: {
              status: 'claimed',
              claimedAt: new Date(),
            },
          });

          return { sender: claimSender };
        });

        // Send emails outside the transaction
        await emailService.sendPeerTransferNotification(
          recipient.email,
          recipient.name,
          sender?.name || 'Guincoin user',
          Number(transfer.amount),
          transfer.message || undefined
        );

        if (sender) {
          await emailService.sendPeerTransferSentNotification(
            sender.email,
            sender.name,
            recipient.name,
            Number(transfer.amount),
            transfer.message || undefined
          );
        }

        claimedTransfers.push(transfer);
      } catch (error) {
        console.error('Failed to claim pending transfer', transfer.id, error);
      }
    }

    return claimedTransfers;
  }

  async cancelPendingTransfer(transferId: string, senderEmployeeId: string) {
    const transfer = await prisma.pendingTransfer.findUnique({
      where: { id: transferId },
      include: {
        senderEmployee: true,
      },
    });

    if (!transfer) {
      throw new Error('Pending transfer not found');
    }

    if (transfer.senderEmployeeId !== senderEmployeeId) {
      throw new Error('You can only cancel your own transfers');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Only pending transfers can be cancelled');
    }

    // Reject the pending transaction
    const senderTransaction = await prisma.ledgerTransaction.findUnique({
      where: { id: transfer.senderTransactionId },
    });

    if (senderTransaction && senderTransaction.status === 'pending') {
      await transactionService.rejectTransaction(senderTransaction.id);
    }

    // Update the pending transfer status to cancelled
    const updatedTransfer = await prisma.pendingTransfer.update({
      where: { id: transferId },
      data: {
        status: 'cancelled',
      },
    });

    return updatedTransfer;
  }
}

export default new PendingTransferService();
