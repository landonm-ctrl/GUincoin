import express from 'express';
import { z } from 'zod';
import { requireManager, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import allotmentService from '../services/allotmentService';
import emailService from '../services/emailService';
import prisma from '../config/database';

const router = express.Router();

// Get current allotment
router.get('/allotment', requireManager, async (req: AuthRequest, res) => {
  try {
    const allotment = await allotmentService.getCurrentAllotment(req.user!.id);
    res.json(allotment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Award coins to employee
const awardSchema = z.object({
  body: z.object({
    employeeEmail: z.string().email(),
    amount: z.number().positive(),
    description: z.string().optional(),
  }),
});

router.post(
  '/award',
  requireManager,
  validate(awardSchema),
  async (req: AuthRequest, res) => {
    try {
      const { employeeEmail, amount, description } = req.body;

      // Award coins
      const transaction = await allotmentService.awardCoins(
        req.user!.id,
        employeeEmail,
        amount,
        description || ''
      );

      // Get recipient info for email
      const recipient = await prisma.employee.findUnique({
        where: { email: employeeEmail },
      });

      if (recipient) {
        // Send email notification
        await emailService.sendManagerAwardNotification(
          recipient.email,
          recipient.name,
          req.user!.name,
          amount,
          description
        );
      }

      await emailService.sendManagerAwardSentNotification(
        req.user!.email,
        req.user!.name,
        recipient?.name || employeeEmail,
        amount,
        description
      );

      res.json({
        message: 'Coins awarded successfully',
        transaction,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get award history
const historySchema = z.object({
  query: z.object({
    limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
    offset: z.string().optional().transform((val) => (val ? parseInt(val) : 0)),
  }),
});

router.get(
  '/history',
  requireManager,
  validate(historySchema),
  async (req: AuthRequest, res) => {
    try {
      const history = await allotmentService.getAwardHistory(
        req.user!.id,
        req.query.limit as number,
        req.query.offset as number
      );
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
