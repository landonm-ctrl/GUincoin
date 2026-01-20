import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from './config/auth';
import { rateLimiter } from './middleware/rateLimiter';
import { getHealthSummary } from './utils/health';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to API routes (except health check)
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
if (rateLimitEnabled) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxRequests = Number(process.env.RATE_LIMIT_MAX ?? (isProd ? 100 : 1000));
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
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
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import managerRoutes from './routes/manager';
import transferRoutes from './routes/transfers';
import wellnessRoutes from './routes/wellness';
import adminRoutes from './routes/admin';
import fileRoutes from './routes/files';
import storeRoutes from './routes/store';
import { errorHandler } from './middleware/errorHandler';

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/store', storeRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
