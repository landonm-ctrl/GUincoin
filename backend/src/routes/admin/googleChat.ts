import express from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/database';
import { z } from 'zod';
import { validate } from '../../middleware/validation';

const router = express.Router();

// Query schema for audit logs
const getAuditLogsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
    status: z.enum(['received', 'authorized', 'rejected', 'failed', 'succeeded']).optional(),
    userEmail: z.string().email().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// Get Google Chat audit logs
router.get(
  '/google-chat/audit-logs',
  validate(getAuditLogsSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { page = 1, limit = 50, status, userEmail, startDate, endDate } = req.query as {
        page?: number;
        limit?: number;
        status?: string;
        userEmail?: string;
        startDate?: string;
        endDate?: string;
      };

      // Build where clause
      const where: any = {
        provider: 'google_chat',
      };

      if (status) {
        where.status = status;
      }

      if (userEmail) {
        where.userEmail = userEmail.toLowerCase();
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await prisma.chatCommandAudit.count({ where });

      // Get audit logs
      const auditLogs = await prisma.chatCommandAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          transaction: {
            select: {
              id: true,
              amount: true,
              description: true,
              createdAt: true,
            },
          },
        },
      });

      res.json({
        data: auditLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get audit log statistics
router.get('/google-chat/stats', async (req: AuthRequest, res, next) => {
  try {
    // Get stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [total, byStatus, recentActivity] = await Promise.all([
      // Total commands
      prisma.chatCommandAudit.count({
        where: {
          provider: 'google_chat',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Commands by status
      prisma.chatCommandAudit.groupBy({
        by: ['status'],
        where: {
          provider: 'google_chat',
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),

      // Recent activity (last 7 days)
      prisma.chatCommandAudit.count({
        where: {
          provider: 'google_chat',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const statusMap = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      total,
      recentActivity,
      byStatus: {
        received: statusMap.received || 0,
        authorized: statusMap.authorized || 0,
        rejected: statusMap.rejected || 0,
        failed: statusMap.failed || 0,
        succeeded: statusMap.succeeded || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
