import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import prisma from '../config/database';

export class TransactionService {
  /**
   * Create a pending transaction in the ledger
   */
  async createPendingTransaction(
    accountId: string,
    transactionType: TransactionType,
    amount: number,
    description?: string,
    sourceEmployeeId?: string,
    targetEmployeeId?: string,
    wellnessSubmissionId?: string
  ) {
    return await prisma.ledgerTransaction.create({
      data: {
        accountId,
        transactionType,
        amount,
        status: TransactionStatus.pending,
        description,
        sourceEmployeeId,
        targetEmployeeId,
        wellnessSubmissionId,
      },
    });
  }

  /**
   * Post a pending transaction (update balance and mark as posted)
   * @param transactionId - The ID of the transaction to post
   * @param tx - Optional Prisma transaction client. If provided, uses this client instead of creating a new transaction.
   */
  async postTransaction(transactionId: string, tx?: any) {
    const executePost = async (client: any) => {
      const transaction = await client.ledgerTransaction.findUnique({
        where: { id: transactionId },
        include: { account: true },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.pending) {
        throw new Error('Transaction is not pending');
      }

      // Update balance based on transaction type
      let balanceChange = 0;
      if (
        transaction.transactionType === TransactionType.manager_award ||
        transaction.transactionType === TransactionType.peer_transfer_received ||
        transaction.transactionType === TransactionType.wellness_reward ||
        transaction.transactionType === TransactionType.adjustment
      ) {
        balanceChange = Number(transaction.amount);
      } else if (
        transaction.transactionType === TransactionType.peer_transfer_sent ||
        transaction.transactionType === TransactionType.store_purchase
      ) {
        balanceChange = -Number(transaction.amount);
      }

      // Update account balance
      await client.account.update({
        where: { id: transaction.accountId },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });

      // Mark transaction as posted
      const updatedTransaction = await client.ledgerTransaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.posted,
          postedAt: new Date(),
        },
      });

      return updatedTransaction;
    };

    // If transaction client is provided, use it directly
    if (tx) {
      return await executePost(tx);
    }

    // Otherwise, create a new transaction
    return await prisma.$transaction(async (tx) => {
      return await executePost(tx);
    });
  }

  /**
   * Reject a pending transaction
   */
  async rejectTransaction(transactionId: string, reason?: string) {
    return await prisma.ledgerTransaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.rejected,
      },
    });
  }

  /**
   * Get account balance (including pending transactions)
   */
  async getAccountBalance(accountId: string, includePending: boolean = false) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const postedBalance = Number(account.balance);

    if (!includePending) {
      return {
        posted: postedBalance,
        pending: 0,
        total: postedBalance,
      };
    }

    // Use aggregate queries instead of loading all transactions
    const [creditPending, debitPending] = await Promise.all([
      // Sum of pending credits (money coming in)
      prisma.ledgerTransaction.aggregate({
        where: {
          accountId,
          status: TransactionStatus.pending,
          transactionType: {
            in: [
              TransactionType.manager_award,
              TransactionType.peer_transfer_received,
              TransactionType.wellness_reward,
              TransactionType.adjustment,
            ],
          },
        },
        _sum: { amount: true },
      }),
      // Sum of pending debits (money going out)
      prisma.ledgerTransaction.aggregate({
        where: {
          accountId,
          status: TransactionStatus.pending,
          transactionType: {
            in: [
              TransactionType.peer_transfer_sent,
              TransactionType.store_purchase,
            ],
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const pendingCredits = Number(creditPending._sum.amount || 0);
    const pendingDebits = Number(debitPending._sum.amount || 0);
    const pendingTotal = pendingCredits - pendingDebits;

    return {
      posted: postedBalance,
      pending: pendingTotal,
      total: postedBalance + pendingTotal,
    };
  }

  /**
   * Get transaction history for an account
   */
  async getTransactionHistory(
    accountId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: TransactionStatus;
      transactionType?: TransactionType;
    }
  ) {
    const where: any = { accountId };
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.transactionType) {
      where.transactionType = options.transactionType;
    }

    const [transactions, total] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where,
        include: {
          sourceEmployee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.ledgerTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    };
  }

  /**
   * Get pending transactions for an account
   */
  async getPendingTransactions(accountId: string) {
    return await prisma.ledgerTransaction.findMany({
      where: {
        accountId,
        status: TransactionStatus.pending,
      },
      include: {
        sourceEmployee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        wellnessSubmission: {
          include: {
            wellnessTask: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default new TransactionService();
