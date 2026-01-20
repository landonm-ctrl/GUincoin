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
  }) {
    const normalizedEmail = params.recipientEmail.toLowerCase();

    const senderTransaction = await transactionService.createPendingTransaction(
      params.senderAccountId,
      'peer_transfer_sent',
      params.amount,
      params.message || `Transfer to ${params.recipientNameFallback}`,
      params.senderEmployeeId
    );

    const pendingTransfer = await prisma.pendingTransfer.create({
      data: {
        senderEmployeeId: params.senderEmployeeId,
        recipientEmail: normalizedEmail,
        amount: params.amount,
        message: params.message,
        senderTransactionId: senderTransaction.id,
      },
    });

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
        const sender = await prisma.employee.findUnique({
          where: { id: transfer.senderEmployeeId },
        });

        const recipientTransaction = await transactionService.createPendingTransaction(
          recipient.account.id,
          'peer_transfer_received',
          Number(transfer.amount),
          transfer.message || `Transfer from ${sender?.name || 'Guincoin user'}`,
          transfer.senderEmployeeId,
          recipient.id
        );

        const senderTransaction = await prisma.ledgerTransaction.findUnique({
          where: { id: transfer.senderTransactionId },
        });

        if (senderTransaction?.status === 'pending') {
          await transactionService.postTransaction(senderTransaction.id);
        }

        await transactionService.postTransaction(recipientTransaction.id);

        await prisma.pendingTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'claimed',
            claimedAt: new Date(),
          },
        });

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
