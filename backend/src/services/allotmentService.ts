import { PrismaClient, PeriodType } from '@prisma/client';
import prisma from '../config/database';
import transactionService from './transactionService';

export class AllotmentService {
  /**
   * Get or create current period allotment for a manager
   */
  async getCurrentAllotment(managerId: string, periodType: PeriodType = PeriodType.monthly) {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (periodType === PeriodType.monthly) {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // Quarterly
      const quarter = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), quarter * 3, 1);
      periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
    }

    let allotment = await prisma.managerAllotment.findFirst({
      where: {
        managerId,
        periodType,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    // If no current allotment exists, create one (default amount can be configured)
    if (!allotment) {
      // This would typically be set by an admin, but for now we'll use a default
      const defaultAmount = 1000; // Can be made configurable
      allotment = await prisma.managerAllotment.create({
        data: {
          managerId,
          periodType,
          amount: defaultAmount,
          periodStart,
          periodEnd,
        },
      });
    }

    // Calculate used amount from posted manager awards in this period
    const usedAmount = await this.calculateUsedAmount(managerId, periodStart, periodEnd);

    return {
      ...allotment,
      usedAmount: Number(usedAmount),
      remaining: Number(allotment.amount) - Number(usedAmount),
    };
  }

  /**
   * Calculate used amount from manager awards in a period
   */
  async calculateUsedAmount(managerId: string, periodStart: Date, periodEnd: Date) {
    const result = await prisma.ledgerTransaction.aggregate({
      where: {
        sourceEmployeeId: managerId,
        transactionType: 'manager_award',
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

    return result._sum.amount || 0;
  }

  /**
   * Check if manager can award the specified amount
   */
  async canAward(managerId: string, amount: number, periodType?: PeriodType) {
    const allotment = await this.getCurrentAllotment(managerId, periodType);
    return Number(allotment.remaining) >= amount;
  }

  /**
   * Award coins to an employee (creates pending transaction)
   */
  async awardCoins(
    managerId: string,
    employeeEmail: string,
    amount: number,
    description: string
  ) {
    // Verify manager can award this amount
    const canAward = await this.canAward(managerId, amount);
    if (!canAward) {
      throw new Error('Insufficient allotment remaining');
    }

    // Find employee
    const employee = await prisma.employee.findUnique({
      where: { email: employeeEmail },
      include: { account: true },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    if (!employee.account) {
      throw new Error('Employee account not found');
    }

    // Create pending transaction
    const transaction = await transactionService.createPendingTransaction(
      employee.account.id,
      'manager_award',
      amount,
      description || `Award from manager`,
      managerId
    );

    // Post immediately (manager awards are auto-posted)
    await transactionService.postTransaction(transaction.id);

    return transaction;
  }

  /**
   * Get award history for a manager
   */
  async getAwardHistory(managerId: string, limit: number = 50, offset: number = 0) {
    const [transactions, total] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where: {
          sourceEmployeeId: managerId,
          transactionType: 'manager_award',
        },
        include: {
          account: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerTransaction.count({
        where: {
          sourceEmployeeId: managerId,
          transactionType: 'manager_award',
        },
      }),
    ]);

    return {
      transactions,
      total,
      limit,
      offset,
    };
  }

  /**
   * Reset allotments for a new period (typically called by a scheduled job)
   */
  async resetAllotments(periodType: PeriodType) {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (periodType === PeriodType.monthly) {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      const quarter = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), quarter * 3, 1);
      periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
    }

    // This would typically be called by an admin or scheduled job
    // For now, it's a manual operation
    // In production, this would create new allotments for all managers
  }
}

export default new AllotmentService();
