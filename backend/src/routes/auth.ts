import express from 'express';
import passport from '../config/auth';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Middleware to check if OAuth is configured
const requireOAuthConfig = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'OAuth is not configured',
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables',
    });
  }
  next();
};

// Google OAuth login
router.get(
  '/google',
  requireOAuthConfig,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  requireOAuthConfig,
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req: AuthRequest, res) => {
    // Successful authentication
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
  }
);

// Get current user
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    name: req.user!.name,
    isManager: req.user!.isManager,
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
