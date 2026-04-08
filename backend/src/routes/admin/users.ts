import express from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/database';
import { z } from 'zod';
import { validate } from '../../middleware/validation';
import { AppError } from '../../utils/errors';
import accountService from '../../services/accountService';
import emailService from '../../services/emailService';
import allotmentService from '../../services/allotmentService';
import { PeriodType } from '@prisma/client';

const router = express.Router();

// Get all employees with their roles
router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isManager: true,
        isAdmin: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(employees);
  } catch (error) {
    next(error);
  }
});

// Create new employee
const createEmployeeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    isManager: z.boolean().optional().default(false),
    isAdmin: z.boolean().optional().default(false),
  }),
});

router.post(
  '/users',
  validate(createEmployeeSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { email, name, isManager, isAdmin } = req.body;

      // Check if employee already exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingEmployee) {
        throw new AppError('Employee with this email already exists', 400);
      }

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          email: email.toLowerCase(),
          name,
          isManager: isManager || false,
          isAdmin: isAdmin || false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isManager: true,
          isAdmin: true,
          createdAt: true,
        },
      });

      // Create account for the employee
      await accountService.getOrCreateAccount(employee.id);

      // Determine role name for email
      const roleName =
        employee.isAdmin && employee.isManager
          ? 'Admin & Manager'
          : employee.isAdmin
          ? 'Admin'
          : employee.isManager
          ? 'Manager'
          : 'Employee';

      // Send email notification
      await emailService.sendRoleAssignedNotification(
        employee.email,
        employee.name,
        roleName,
        employee.isManager,
        employee.isAdmin
      );

      res.status(201).json(employee);
    } catch (error) {
      next(error);
    }
  }
);

// Update employee roles
const updateRolesSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    isManager: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
  }),
});

router.put(
  '/users/:id/roles',
  validate(updateRolesSchema),
  async (req: AuthRequest, res, next) => {
    try {
      // Prevent admin from removing their own admin status
      if (req.params.id === req.user!.id && req.body.isAdmin === false) {
        throw new AppError('You cannot remove your own admin status', 400);
      }

      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
      });

      if (!employee) {
        throw new AppError('Employee not found', 404);
      }

      const wasManager = employee.isManager;
      const wasAdmin = employee.isAdmin;
      const newIsManager = req.body.isManager !== undefined ? req.body.isManager : employee.isManager;
      const newIsAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : employee.isAdmin;

      const updated = await prisma.employee.update({
        where: { id: req.params.id },
        data: {
          isManager: newIsManager,
          isAdmin: newIsAdmin,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isManager: true,
          isAdmin: true,
          createdAt: true,
        },
      });

      // Send email notification if role changed
      if ((wasManager !== newIsManager || wasAdmin !== newIsAdmin) && (newIsManager || newIsAdmin)) {
        const roleName =
          updated.isAdmin && updated.isManager
            ? 'Admin & Manager'
            : updated.isAdmin
            ? 'Admin'
            : updated.isManager
            ? 'Manager'
            : 'Employee';

        await emailService.sendRoleAssignedNotification(
          updated.email,
          updated.name,
          roleName,
          updated.isManager,
          updated.isAdmin
        );
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Get balance report (all users with balances and manager allotments)
router.get('/balances-report', async (req: AuthRequest, res, next) => {
  try {
    // Get all employees with their accounts
    const employees = await prisma.employee.findMany({
      include: {
        account: true,
      },
      orderBy: { name: 'asc' },
    });

    // Build report data
    const reportData = await Promise.all(
      employees.map(async (employee) => {
        const account = employee.account || await accountService.getOrCreateAccount(employee.id);
        const balance = Number(account.balance);

        // For managers, get their current allotment
        let allotmentData = null;
        if (employee.isManager) {
          try {
            const allotment = await allotmentService.getCurrentAllotment(employee.id, PeriodType.monthly);
            allotmentData = {
              total: Number(allotment.amount),
              used: allotment.usedAmount,
              remaining: allotment.remaining,
              periodStart: allotment.periodStart.toISOString(),
              periodEnd: allotment.periodEnd.toISOString(),
            };
          } catch (error) {
            // If no allotment exists, set to null
            allotmentData = null;
          }
        }

        return {
          employeeId: employee.id,
          name: employee.name,
          email: employee.email,
          isManager: employee.isManager,
          isAdmin: employee.isAdmin,
          userBalance: balance,
          allotment: allotmentData,
        };
      })
    );

    // Calculate totals
    const totalUserBalances = reportData.reduce((sum, row) => sum + row.userBalance, 0);
    const totalAllotmentRemaining = reportData.reduce(
      (sum, row) => sum + (row.allotment?.remaining || 0),
      0
    );
    const totalInCirculation = totalUserBalances + totalAllotmentRemaining;

    res.json({
      reportData,
      totals: {
        totalUserBalances,
        totalAllotmentRemaining,
        totalInCirculation,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Deposit into manager's allotment balance
const depositAllotmentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    amount: z.number().positive(),
    description: z.string().optional(),
  }),
});

router.post(
  '/users/:id/allotment/deposit',
  validate(depositAllotmentSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { amount, description } = req.body;

      // Deposit into manager's allotment
      const transaction = await allotmentService.depositAllotment(
        req.params.id,
        amount,
        description || 'Allotment deposit',
        req.user!.id
      );

      // Get updated allotment info
      const allotment = await allotmentService.getCurrentAllotment(req.params.id);

      // Get manager info for email notification
      const manager = await prisma.employee.findUnique({
        where: { id: req.params.id },
      });

      if (manager) {
        await emailService.sendAllotmentDepositNotification(
          manager.email,
          manager.name,
          amount,
          Number(allotment.balance)
        );
      }

      res.json({
        message: 'Allotment deposited successfully',
        transaction: {
          id: transaction.id,
          amount: Number(transaction.amount),
          description: transaction.description,
          createdAt: transaction.createdAt,
        },
        newBalance: Number(allotment.balance),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get manager's allotment details (for admin view)
router.get(
  '/users/:id/allotment',
  async (req: AuthRequest, res, next) => {
    try {
      // Check if target user is a manager
      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
        include: { account: true },
      });

      if (!employee) {
        throw new AppError('Employee not found', 404);
      }

      if (!employee.isManager) {
        throw new AppError('Employee is not a manager', 400);
      }

      const allotment = await allotmentService.getCurrentAllotment(req.params.id);
      const depositHistory = await allotmentService.getDepositHistory(req.params.id, 10);
      const awardHistory = await allotmentService.getAwardHistory(req.params.id, 10);

      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
        },
        allotment: {
          balance: Number(allotment.balance),
          recurringBudget: Number(allotment.recurringBudget),
          usedThisPeriod: Number(allotment.usedThisPeriod),
          periodStart: allotment.periodStart,
          periodEnd: allotment.periodEnd,
        },
        recentDeposits: depositHistory.transactions.map((t: any) => ({
          id: t.id,
          amount: Number(t.amount),
          description: t.description,
          createdAt: t.createdAt,
          fromAdmin: t.sourceEmployee?.name || 'System',
        })),
        recentAwards: awardHistory.transactions.map((t: any) => ({
          id: t.id,
          amount: Number(t.amount),
          description: t.description,
          createdAt: t.createdAt,
          toEmployee: t.account?.employee?.name || 'Unknown',
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Set recurring budget for a manager
const setRecurringBudgetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    amount: z.number().min(0),
    periodType: z.enum(['monthly', 'quarterly']).optional(),
  }),
});

router.put(
  '/users/:id/allotment/recurring',
  validate(setRecurringBudgetSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { amount, periodType } = req.body;

      await allotmentService.setRecurringBudget(
        req.params.id,
        amount,
        periodType === 'quarterly' ? PeriodType.quarterly : PeriodType.monthly
      );

      res.json({
        message: 'Recurring budget updated successfully',
        amount,
        periodType: periodType || 'monthly',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
