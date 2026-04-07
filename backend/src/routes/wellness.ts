import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import { upload, getFileUrl } from '../services/fileService';
import { FrequencyRule } from '@prisma/client';
import { wrapAsync } from '../utils/wrapAsync';
import { AppError } from '../utils/errors';
import { validateUploadedFile } from '../utils/fileValidation';

const router = express.Router();

// Get available wellness tasks
router.get('/tasks', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const tasks = await prisma.wellnessTask.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const normalizedTasks = tasks.map((task) => ({
    ...task,
    coinValue: Number(task.coinValue),
  }));

  res.json(normalizedTasks);
}));

// Get wellness task by ID
router.get('/tasks/:id', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const task = await prisma.wellnessTask.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  res.json({
    ...task,
    coinValue: Number(task.coinValue),
  });
}));

// Submit wellness task
router.post(
  '/submit',
  requireAuth,
  upload.single('document'),
  wrapAsync(async (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('Document file is required', 400);
    }

    await validateUploadedFile(req.file.path, 'document');

    const { wellnessTaskId } = req.body;

    if (!wellnessTaskId) {
      throw new AppError('Wellness task ID is required', 400);
    }

    // Get task
    const task = await prisma.wellnessTask.findUnique({
      where: { id: wellnessTaskId },
    });

    if (!task || !task.isActive) {
      throw new AppError('Wellness task not found', 404);
    }

    // Check frequency rules
    if (task.frequencyRule === FrequencyRule.one_time) {
      const existing = await prisma.wellnessSubmission.findFirst({
        where: {
          employeeId: req.user!.id,
          wellnessTaskId: task.id,
          status: { in: ['pending', 'approved'] },
        },
      });

      if (existing) {
        throw new AppError('This task can only be completed once', 400);
      }
    } else if (task.frequencyRule === FrequencyRule.annual) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const recent = await prisma.wellnessSubmission.findFirst({
        where: {
          employeeId: req.user!.id,
          wellnessTaskId: task.id,
          status: 'approved',
          reviewedAt: { gte: oneYearAgo },
        },
      });

      if (recent) {
        throw new AppError('This task can only be completed once per year', 400);
      }
    }

    if (task.maxRewardedUsers) {
      const approvedCount = await prisma.wellnessSubmission.count({
        where: {
          wellnessTaskId: task.id,
          status: 'approved',
        },
      });

      if (approvedCount >= task.maxRewardedUsers) {
        throw new AppError('This task has reached its reward limit', 400);
      }
    }

    // Get employee account
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      include: { account: true },
    });

    if (!employee || !employee.account) {
      throw new AppError('Account not found', 404);
    }

    // Create submission
    const submission = await prisma.wellnessSubmission.create({
      data: {
        employeeId: req.user!.id,
        wellnessTaskId: task.id,
        documentUrl: getFileUrl(req.file.filename),
        status: 'pending',
      },
    });

    // Create pending transaction
    const transaction = await transactionService.createPendingTransaction(
      employee.account.id,
      'wellness_reward',
      Number(task.coinValue),
      `Wellness reward: ${task.name}`,
      undefined,
      undefined,
      submission.id
    );

    res.json({
      message: 'Submission created successfully',
      submission,
      transaction,
    });
  })
);

// Get employee's wellness submissions
router.get('/submissions', requireAuth, wrapAsync(async (req: AuthRequest, res) => {
  const submissions = await prisma.wellnessSubmission.findMany({
    where: { employeeId: req.user!.id },
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
      coinValue: Number(submission.wellnessTask.coinValue),
    },
    transaction: submission.transaction
      ? {
          ...submission.transaction,
          amount: Number(submission.transaction.amount),
        }
      : submission.transaction,
  }));

  res.json(normalizedSubmissions);
}));


export default router;
