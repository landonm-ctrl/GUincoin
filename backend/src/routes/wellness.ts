import express from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import prisma from '../config/database';
import transactionService from '../services/transactionService';
import { upload, getFileUrl } from '../services/fileService';
import { FrequencyRule } from '@prisma/client';

const router = express.Router();

// Get available wellness tasks
router.get('/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tasks = await prisma.wellnessTask.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      coinValue: Number(task.coinValue),
    }));

    res.json(normalizedTasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get wellness task by ID
router.get('/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.wellnessTask.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      ...task,
      coinValue: Number(task.coinValue),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit wellness task
router.post(
  '/submit',
  requireAuth,
  upload.single('document'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Document file is required' });
      }

      const { wellnessTaskId } = req.body;

      if (!wellnessTaskId) {
        return res.status(400).json({ error: 'Wellness task ID is required' });
      }

      // Get task
      const task = await prisma.wellnessTask.findUnique({
        where: { id: wellnessTaskId },
      });

      if (!task || !task.isActive) {
        return res.status(404).json({ error: 'Wellness task not found' });
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
          return res
            .status(400)
            .json({ error: 'This task can only be completed once' });
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
          return res
            .status(400)
            .json({ error: 'This task can only be completed once per year' });
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
          return res.status(400).json({ error: 'This task has reached its reward limit' });
        }
      }

      // Get employee account
      const employee = await prisma.employee.findUnique({
        where: { id: req.user!.id },
        include: { account: true },
      });

      if (!employee || !employee.account) {
        return res.status(404).json({ error: 'Account not found' });
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
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get employee's wellness submissions
router.get('/submissions', requireAuth, async (req: AuthRequest, res) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


export default router;
