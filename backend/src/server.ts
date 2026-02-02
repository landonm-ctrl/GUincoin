import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import session, { Store } from 'express-session';
import pgSession from 'connect-pg-simple';
import passport from './config/auth';
import { rateLimiter } from './middleware/rateLimiter';
import { getHealthSummary, setSessionStoreType } from './utils/health';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { SESSION_MAX_AGE_MS } from './config/constants';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import managerRoutes from './routes/manager';
import transferRoutes from './routes/transfers';
import wellnessRoutes from './routes/wellness';
import adminRoutes from './routes/admin/index';
import fileRoutes from './routes/files';
import storeRoutes from './routes/store';
import googleChatRoutes from './routes/googleChat';
import bannerRoutes from './routes/banners';
import gamesRoutes from './routes/games';
import superBowlRoutes from './routes/superBowl';

dotenv.config();

const PgStore = pgSession(session);

/**
 * Create session store with fallback to memory store if PostgreSQL fails.
 */
function createSessionStore(): Store | undefined {
  try {
    const pgStore = new PgStore({
      conString: env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true,
      errorLog: (err) => {
        console.error('[SessionStore] PostgreSQL error:', err.message);
      },
    });
    console.log('[SessionStore] Using PostgreSQL session store');
    setSessionStoreType('postgresql');
    return pgStore;
  } catch (error) {
    console.warn(
      '[SessionStore] Failed to create PostgreSQL store, falling back to memory store:',
      error instanceof Error ? error.message : error
    );
    console.warn('[SessionStore] WARNING: Memory store is not suitable for production!');
    setSessionStoreType('memory');
    return undefined; // Express will use default MemoryStore
  }
}

const app = express();
const PORT = env.PORT;

// Middleware
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with PostgreSQL store (with memory fallback)
const sessionStore = createSessionStore();
app.use(session({
  store: sessionStore,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to API routes (except health check)
if (env.RATE_LIMIT_ENABLED) {
  const isProd = env.NODE_ENV === 'production';
  const maxRequests = env.RATE_LIMIT_MAX ?? (isProd ? 100 : 1000);
  const windowMs = env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000;
  if (Number.isFinite(maxRequests) && maxRequests > 0) {
    app.use('/api', rateLimiter(maxRequests, windowMs));
  }
}

// Health check endpoint
app.get('/health', async (req, res, next) => {
  try {
    const summary = await getHealthSummary();
    const statusCode = summary.status === 'ok' ? 200 : 503;

    res
      .status(statusCode)
      .setHeader('Cache-Control', 'no-store')
      .json(summary);
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/integrations/google-chat', googleChatRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/super-bowl', superBowlRoutes);

// 404 handler for unmatched API routes
app.use('/api', notFoundHandler);

// Serve frontend static files in production
if (env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend-dist');

  // Serve static files
  app.use(express.static(frontendBuildPath));

  // Catch-all route for client-side routing (React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server with graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Setup graceful shutdown handling
setupGracefulShutdown(server);

export default app;
