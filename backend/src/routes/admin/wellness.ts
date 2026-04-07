import express from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import prisma from '../../config/database';
import transactionService from '../../services/transactionService';
import accountService from '../../services/accountService';
import emailService from '../../services/emailService';
import { upload, getFileUrl } from '../../services/fileService';
import { AppError } from '../../utils/errors';
import { validateUploadedFile } from '../../utils/fileValidation';
import { FrequencyRule } from '@prisma/client';
import { toNumber } from '../../utils/number';

const router = express.Router();

const wellnessTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  coinValue: z.coerce.number().positive(),
  frequencyRule: z.nativeEnum(FrequencyRule),
  maxRewardedUsers: z.coerce.number().int().positive().optional(),
});

// Create wellness task
router.post(
  '/wellness/tasks',
  upload.single('template'),
  async (req: AuthRequest, res, next) => {
    try {
      if (req.file) {
        await validateUploadedFile(req.file.path, 'document');
      }

      const normalizedBody = { ...req.body };
      if (normalizedBody.maxRewardedUsers === '') {
        delete normalizedBody.maxRewardedUsers;
      }

      const parsed = wellnessTaskSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message || 'Invalid data', 400);
      }

      const { name, description, instructions, coinValue, frequencyRule, maxRewardedUsers } =
        parsed.data;

      const task = await prisma.wellnessTask.create({
        data: {
          name,
          description: description || null,
          instructions: instructions || null,
          coinValue,
          frequencyRule,
          requiresApproval: true,
          formTemplateUrl: req.file ? getFileUrl(req.file.filename) : null,
          maxRewardedUsers: maxRewardedUsers || null,
        },
      });

      res.json(task);
    } catch (error) {
      next(error);
    }
  }
);

// Get all wellness tasks (including inactive)
router.get('/wellness/tasks', async (_req: AuthRequest, res, next) => {
  try {
    const tasks = await prisma.wellnessTask.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      coinValue: toNumber(task.coinValue),
    }));

    res.json(normalizedTasks);
  } catch (error) {
    next(error);
  }
});

// Delete wellness task (set inactive to preserve data)
router.delete('/wellness/tasks/:id', async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.wellnessTask.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      throw new AppError('Wellness task not found', 404);
    }

    // Set isActive to false instead of deleting
    await prisma.wellnessTask.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Wellness task deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all users with their wellness submissions
router.get('/wellness/users', async (_req: AuthRequest, res, next) => {
  try {
    const users = await prisma.employee.findMany({
      include: {
        wellnessSubmissions: {
          include: {
            wellnessTask: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            transaction: {
              select: {
                id: true,
                status: true,
                amount: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const normalizedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      submissions: user.wellnessSubmissions.map((submission) => ({
        ...submission,
        wellnessTask: {
          ...submission.wellnessTask,
        },
        transaction: submission.transaction
          ? {
              ...submission.transaction,
              amount: toNumber(submission.transaction.amount),
            }
          : null,
      })),
    }));

    res.json(normalizedUsers);
  } catch (error) {
    next(error);
  }
});

// Get wellness submissions for a specific user
router.get('/wellness/users/:id/submissions', async (req: AuthRequest, res, next) => {
  try {
    const submissions = await prisma.wellnessSubmission.findMany({
      where: { employeeId: req.params.id },
      include: {
        wellnessTask: true,
        transaction: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const normalizedSubmissions = submissions.map((submission) => ({
      ...submission,
      wellnessTask: {
        ...submission.wellnessTask,
        coinValue: toNumber(submission.wellnessTask.coinValue),
      },
      transaction: submission.transaction
        ? {
            ...submission.transaction,
            amount: toNumber(submission.transaction.amount),
          }
        : null,
    }));

    res.json(normalizedSubmissions);
  } catch (error) {
    next(error);
  }
});

// Get pending wellness submissions
router.get('/wellness/pending', async (req: AuthRequest, res, next) => {
  try {
    const submissions = await prisma.wellnessSubmission.findMany({
      where: { status: 'pending' },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        wellnessTask: true,
        transaction: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    const normalizedSubmissions = submissions.map((submission) => ({
      ...submission,
      wellnessTask: {
        ...submission.wellnessTask,
        coinValue: toNumber(submission.wellnessTask.coinValue),
      },
      transaction: submission.transaction
        ? {
            ...submission.transaction,
            amount: toNumber(submission.transaction.amount),
          }
        : submission.transaction,
    }));

    res.json(normalizedSubmissions);
  } catch (error) {
    next(error);
  }
});

// Approve wellness submission
const approveSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

router.post(
  '/wellness/:id/approve',
  validate(approveSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const submission = await prisma.wellnessSubmission.findUnique({
        where: { id: req.params.id },
        include: {
          employee: true,
          wellnessTask: true,
          transaction: true,
        },
      });

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (submission.status !== 'pending') {
        throw new AppError('Submission is not pending approval', 400);
      }

      if (submission.wellnessTask.maxRewardedUsers) {
        const approvedCount = await prisma.wellnessSubmission.count({
          where: {
            wellnessTaskId: submission.wellnessTaskId,
            status: 'approved',
          },
        });

        if (approvedCount >= submission.wellnessTask.maxRewardedUsers) {
          await prisma.wellnessSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'rejected',
              rejectionReason: 'Maximum rewards reached for this task',
              reviewedById: req.user!.id,
              reviewedAt: new Date(),
            },
          });

          if (submission.transaction) {
            await transactionService.rejectTransaction(submission.transaction.id);
          }

          await emailService.sendWellnessRejectionNotification(
            submission.employee.email,
            submission.employee.name,
            submission.wellnessTask.name,
            'Maximum rewards reached for this task'
          );

          throw new AppError('This task has reached its reward limit', 400);
        }
      }

      // Get employee account
      const employee = await prisma.employee.findUnique({
        where: { id: submission.employeeId },
        include: { account: true },
      });

      if (!employee) {
        throw new AppError('Employee not found', 404);
      }

      // Auto-create account if it doesn't exist
      const account = await accountService.getOrCreateAccountForEmployee(employee);

      // Create and post the transaction (only upon approval)
      let transaction = submission.transaction;
      if (!transaction) {
        transaction = await transactionService.createPendingTransaction(
          account.id,
          'wellness_reward',
          toNumber(submission.wellnessTask.coinValue),
          `Wellness reward: ${submission.wellnessTask.name}`,
          undefined,
          undefined,
          submission.id
        );
      }

      // Update submission status
      await prisma.wellnessSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'approved',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
      });

      // Post the transaction
      await transactionService.postTransaction(transaction.id);

      // Send approval email
      await emailService.sendWellnessApprovalNotification(
        submission.employee.email,
        submission.employee.name,
        submission.wellnessTask.name,
        toNumber(submission.wellnessTask.coinValue)
      );

      res.json({ message: 'Submission approved successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Reject wellness submission
const rejectSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

router.post(
  '/wellness/:id/reject',
  validate(rejectSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const submission = await prisma.wellnessSubmission.findUnique({
        where: { id: req.params.id },
        include: {
          employee: true,
          wellnessTask: true,
          transaction: true,
        },
      });

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (submission.status !== 'pending') {
        throw new AppError('Submission is not pending approval', 400);
      }

      // Update submission status
      await prisma.wellnessSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'rejected',
          rejectionReason: req.body.reason,
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
      });

      // Reject the transaction
      if (submission.transaction) {
        await transactionService.rejectTransaction(submission.transaction.id);
      }

      // Send rejection email
      await emailService.sendWellnessRejectionNotification(
        submission.employee.email,
        submission.employee.name,
        submission.wellnessTask.name,
        req.body.reason
      );

      res.json({ message: 'Submission rejected' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
