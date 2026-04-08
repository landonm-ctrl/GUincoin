import { doubleCsrf } from 'csrf-csrf';
import { env } from '../config/env';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.session?.id ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

export { doubleCsrfProtection, generateCsrfToken };
