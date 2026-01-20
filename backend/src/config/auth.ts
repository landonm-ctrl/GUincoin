import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './database';
import pendingTransferService from '../services/pendingTransferService';

// Conditionally register Google OAuth strategy if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Verify Google Workspace domain
          const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN;
          if (workspaceDomain && !email.endsWith(workspaceDomain)) {
            return done(new Error(`Email must be from ${workspaceDomain} domain`), undefined);
          }

          // Find or create employee
          let employee = await prisma.employee.findUnique({
            where: { email },
          });

          if (!employee) {
            employee = await prisma.employee.create({
              data: {
                email,
                name: profile.displayName || email.split('@')[0],
                isManager: false, // Default, can be updated by admin
              },
            });

            // Create account for new employee
            await prisma.account.create({
              data: {
                employeeId: employee.id,
                balance: 0,
              },
            });
          } else {
            const existingAccount = await prisma.account.findUnique({
              where: { employeeId: employee.id },
            });
            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  employeeId: employee.id,
                  balance: 0,
                },
              });
            }
          }

          await pendingTransferService.claimPendingTransfers(email);

          return done(null, employee);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
} else {
  console.warn('⚠️  Google OAuth credentials not found. OAuth login will be disabled.');
  console.warn('   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file to enable OAuth.');
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { account: true },
    });
    done(null, employee);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
