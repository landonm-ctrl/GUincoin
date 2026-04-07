/**
 * Admin Games Routes - Manage game configurations and jackpots
 *
 * Handles:
 * - Game enable/disable
 * - Game configuration (bet limits, house edge)
 * - Jackpot management
 * - Game statistics viewing
 */

import express from 'express';
import { z } from 'zod';
import { GameType, JackpotType } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { gameEngine, jackpotService } from '../../services/games';
import prisma from '../../config/database';
import { AppError } from '../../utils/errors';

const router = express.Router();

// Auth and admin checks are handled by the admin router-level middleware

// Valid game types
const gameTypes = [
  'coin_flip',
  'dice_roll',
  'spin_wheel',
  'higher_lower',
  'scratch_card',
  'daily_bonus',
] as const;

// ============= GAME CONFIGURATION =============

/**
 * Get all game configurations
 */
router.get('/config', async (req: AuthRequest, res, next) => {
  try {
    const configs = await prisma.gameConfig.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    // Merge with defaults for any missing types
    const allConfigs = await Promise.all(
      gameTypes.map(async (type) => {
        const existing = configs.find((c) => c.gameType === type);
        if (existing) {
          return {
            id: existing.id,
            gameType: existing.gameType,
            enabled: existing.enabled,
            minBet: Number(existing.minBet),
            maxBet: Number(existing.maxBet),
            payoutMultiplier: existing.payoutMultiplier
              ? Number(existing.payoutMultiplier)
              : null,
            jackpotContributionRate: Number(existing.jackpotContributionRate),
            availableInChat: existing.availableInChat,
            availableOnWeb: existing.availableOnWeb,
            displayOrder: existing.displayOrder,
            customConfig: existing.customConfig,
          };
        }
        // Return default config
        const defaultConfig = await gameEngine.getGameConfig(type as GameType);
        return {
          id: null,
          gameType: type,
          ...defaultConfig,
          payoutMultiplier: null,
          displayOrder: gameTypes.indexOf(type),
          customConfig: null,
        };
      })
    );

    res.json(allConfigs);
  } catch (error) {
    next(error);
  }
});

/**
 * Update game configuration
 */
const updateConfigSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    minBet: z.number().nonnegative().optional(),
    maxBet: z.number().positive().optional(),
    payoutMultiplier: z.number().positive().nullable().optional(),
    jackpotContributionRate: z.number().min(0).max(1).optional(),
    availableInChat: z.boolean().optional(),
    availableOnWeb: z.boolean().optional(),
    displayOrder: z.number().int().nonnegative().optional(),
    customConfig: z.record(z.unknown()).nullable().optional(),
  }),
});

router.put(
  '/config/:gameType',
  validate(updateConfigSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { gameType } = req.params;

      if (!gameTypes.includes(gameType as typeof gameTypes[number])) {
        throw new AppError('Invalid game type', 400);
      }

      const data = req.body;

      // Validate min/max bet relationship
      if (data.minBet !== undefined && data.maxBet !== undefined) {
        if (data.minBet > data.maxBet) {
          throw new AppError('Minimum bet cannot exceed maximum bet', 400);
        }
      }

      const config = await prisma.gameConfig.upsert({
        where: { gameType: gameType as GameType },
        update: data,
        create: {
          gameType: gameType as GameType,
          ...data,
        },
      });

      res.json({
        id: config.id,
        gameType: config.gameType,
        enabled: config.enabled,
        minBet: Number(config.minBet),
        maxBet: Number(config.maxBet),
        payoutMultiplier: config.payoutMultiplier
          ? Number(config.payoutMultiplier)
          : null,
        jackpotContributionRate: Number(config.jackpotContributionRate),
        availableInChat: config.availableInChat,
        availableOnWeb: config.availableOnWeb,
        displayOrder: config.displayOrder,
        customConfig: config.customConfig,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Toggle game enabled status
 */
router.post('/config/:gameType/toggle', async (req: AuthRequest, res, next) => {
  try {
    const { gameType } = req.params;

    if (!gameTypes.includes(gameType as typeof gameTypes[number])) {
      throw new AppError('Invalid game type', 400);
    }

    // Get current config
    const existing = await prisma.gameConfig.findUnique({
      where: { gameType: gameType as GameType },
    });

    const newEnabled = existing ? !existing.enabled : false;

    const config = await prisma.gameConfig.upsert({
      where: { gameType: gameType as GameType },
      update: { enabled: newEnabled },
      create: {
        gameType: gameType as GameType,
        enabled: newEnabled,
      },
    });

    res.json({
      gameType: config.gameType,
      enabled: config.enabled,
    });
  } catch (error) {
    next(error);
  }
});

// ============= GAME STATISTICS =============

/**
 * Get overall game statistics
 */
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    // Get aggregated stats
    const [
      totalGames,
      totalPlayers,
      gamesByType,
      recentGames,
    ] = await Promise.all([
      prisma.game.count(),
      prisma.gameStats.count(),
      prisma.game.groupBy({
        by: ['type'],
        _count: true,
        _sum: {
          nonce: true, // Use as proxy for total bets
        },
      }),
      prisma.game.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          participants: {
            include: {
              employee: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    // Calculate totals from GameStats
    const statsAggregates = await prisma.gameStats.aggregate({
      _sum: {
        gamesPlayed: true,
        gamesWon: true,
        totalBet: true,
        totalWon: true,
        netProfit: true,
        jackpotsWon: true,
        totalJackpotWinnings: true,
      },
    });

    res.json({
      totals: {
        games: totalGames,
        uniquePlayers: totalPlayers,
        totalBet: Number(statsAggregates._sum.totalBet) || 0,
        totalWon: Number(statsAggregates._sum.totalWon) || 0,
        houseProfit: -(Number(statsAggregates._sum.netProfit) || 0),
        jackpotsWon: statsAggregates._sum.jackpotsWon || 0,
        jackpotPayouts: Number(statsAggregates._sum.totalJackpotWinnings) || 0,
      },
      byGameType: gamesByType.map((g) => ({
        type: g.type,
        count: g._count,
      })),
      recentGames: recentGames.map((g) => ({
        id: g.id,
        type: g.type,
        status: g.status,
        createdAt: g.createdAt,
        participants: g.participants.map((p) => ({
          name: p.employee.name,
          betAmount: Number(p.betAmount),
          payout: p.payout ? Number(p.payout) : null,
          isWinner: p.isWinner,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get player statistics (admin view)
 */
router.get('/stats/players', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const sortBy = (req.query.sortBy as string) || 'netProfit';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const players = await prisma.gameStats.findMany({
      take: limit,
      skip: offset,
      orderBy: { [sortBy]: sortOrder },
      include: {
        employee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const total = await prisma.gameStats.count();

    res.json({
      players: players.map((p) => ({
        employeeId: p.employeeId,
        name: p.employee.name,
        email: p.employee.email,
        gamesPlayed: p.gamesPlayed,
        gamesWon: p.gamesWon,
        winRate: p.gamesPlayed > 0 ? p.gamesWon / p.gamesPlayed : 0,
        totalBet: Number(p.totalBet),
        totalWon: Number(p.totalWon),
        netProfit: Number(p.netProfit),
        longestWinStreak: p.longestWinStreak,
        jackpotsWon: p.jackpotsWon,
        totalJackpotWinnings: Number(p.totalJackpotWinnings),
        statsByGame: p.statsByGame,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============= JACKPOT MANAGEMENT =============

/**
 * Get all jackpots (including inactive)
 */
router.get('/jackpots', async (req: AuthRequest, res, next) => {
  try {
    const jackpots = await prisma.jackpot.findMany({
      orderBy: [{ isActive: 'desc' }, { balance: 'desc' }],
    });

    res.json(
      jackpots.map((j) => ({
        id: j.id,
        name: j.name,
        type: j.type,
        balance: Number(j.balance),
        isActive: j.isActive,
        lastWonAt: j.lastWonAt,
        lastWonBy: j.lastWonBy,
        lastWonAmount: j.lastWonAmount ? Number(j.lastWonAmount) : null,
        createdAt: j.createdAt,
      }))
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new jackpot (for events)
 */
const createJackpotSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['rolling', 'daily', 'weekly', 'event']),
    initialBalance: z.number().nonnegative().optional().default(0),
  }),
});

router.post(
  '/jackpots',
  validate(createJackpotSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { name, type, initialBalance } = req.body;

      const jackpot = await prisma.jackpot.create({
        data: {
          name,
          type: type as JackpotType,
          balance: initialBalance,
          isActive: true,
        },
      });

      res.status(201).json({
        id: jackpot.id,
        name: jackpot.name,
        type: jackpot.type,
        balance: Number(jackpot.balance),
        isActive: jackpot.isActive,
        createdAt: jackpot.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update jackpot settings
 */
const updateJackpotSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
  }),
});

router.put(
  '/jackpots/:jackpotId',
  validate(updateJackpotSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const jackpot = await prisma.jackpot.update({
        where: { id: req.params.jackpotId },
        data: req.body,
      });

      res.json({
        id: jackpot.id,
        name: jackpot.name,
        type: jackpot.type,
        balance: Number(jackpot.balance),
        isActive: jackpot.isActive,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Toggle jackpot active status
 */
router.post('/jackpots/:jackpotId/toggle', async (req: AuthRequest, res, next) => {
  try {
    const jackpot = await jackpotService.toggleJackpot(req.params.jackpotId);

    res.json({
      id: jackpot.id,
      name: jackpot.name,
      isActive: jackpot.isActive,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Adjust jackpot balance (with audit)
 */
const adjustBalanceSchema = z.object({
  body: z.object({
    adjustment: z.number(),
    reason: z.string().min(1).max(500),
  }),
});

router.post(
  '/jackpots/:jackpotId/adjust',
  validate(adjustBalanceSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { adjustment, reason } = req.body;

      const jackpot = await jackpotService.adminAdjustBalance(
        req.params.jackpotId,
        adjustment,
        req.user!.id,
        reason
      );

      res.json({
        id: jackpot.id,
        name: jackpot.name,
        balance: Number(jackpot.balance),
        adjustment,
        reason,
        adjustedBy: req.user!.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Trigger a manual jackpot drawing
 */
const triggerDrawingSchema = z.object({
  body: z.object({
    type: z.enum(['daily', 'weekly']),
  }),
});

router.post(
  '/jackpots/trigger-drawing',
  validate(triggerDrawingSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { type } = req.body;

      const result = await jackpotService.triggerScheduledDrawing(
        type as JackpotType
      );

      if (!result) {
        res.json({
          success: false,
          message: 'No active jackpot of this type or balance is zero',
        });
        return;
      }

      if (!result.winner) {
        res.json({
          success: false,
          message: 'No eligible players for drawing. Balance rolled over.',
          amount: result.amount,
        });
        return;
      }

      // Get winner details
      const winner = await prisma.employee.findUnique({
        where: { id: result.winner },
        select: { id: true, name: true, email: true },
      });

      res.json({
        success: true,
        winner: winner,
        amount: result.amount,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get jackpot contribution history
 */
router.get('/jackpots/:jackpotId/contributions', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const [contributions, total] = await Promise.all([
      prisma.jackpotContribution.findMany({
        where: { jackpotId: req.params.jackpotId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: { id: true, name: true },
          },
          game: {
            select: { id: true, type: true },
          },
        },
      }),
      prisma.jackpotContribution.count({
        where: { jackpotId: req.params.jackpotId },
      }),
    ]);

    res.json({
      contributions: contributions.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeName: c.employee.name,
        gameId: c.gameId,
        gameType: c.game?.type,
        amount: Number(c.amount),
        createdAt: c.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Initialize default jackpots
 */
router.post('/jackpots/initialize', async (req: AuthRequest, res, next) => {
  try {
    await jackpotService.initializeJackpots();
    const jackpots = await jackpotService.getJackpotStatus();

    res.json({
      message: 'Jackpots initialized',
      jackpots,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
