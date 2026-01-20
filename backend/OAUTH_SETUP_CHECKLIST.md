# Google OAuth Setup Checklist

## ✅ Code Changes Made

- [x] Updated `backend/src/config/auth.ts` to skip Google strategy registration if env vars are missing (dev-safe)
- [x] Updated `backend/src/routes/auth.ts` to return clear 503 errors if OAuth routes are accessed without configuration
- [x] Created `backend/.env` file with all required variables (placeholders)
- [x] Created `backend/GOOGLE_OAUTH_SETUP.md` with detailed setup instructions

## 🔧 Environment Variables Required

Copy these into your `backend/.env` file (already created with placeholders):

```env
# Required for OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=generate-a-random-secret-here

# Optional - restrict to your domain
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/guincoin?schema=public

# Server
PORT=5000
NODE_ENV=development
```

## 📋 Google Cloud Console Setup Steps

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**
3. **Configure OAuth Consent Screen**:
   - User type: Internal (if Workspace) or External (for any Google account)
   - App name: Guincoin Rewards Platform
   - Scopes: `email`, `profile`
   - Test users: Add your Google account (if External)
4. **Create OAuth Client ID**:
   - Type: **Web application**
   - Authorized JavaScript origins: 
     - `http://localhost:3000`
     - `http://localhost:5000`
   - Authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback`
5. **Copy credentials** to `.env`:
   - Client ID (format: `xxxxx.apps.googleusercontent.com`)
   - Client secret (format: `GOCSPX-xxxxx`)

## 🚀 Commands to Run

After setting up Google OAuth credentials in `.env`:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Validate Prisma schema
npx prisma validate

# 3. Run database migrations (if database is set up)
npm run migrate

# 4. Start the backend server
npm run dev
```

Expected output:
```
Server running on port 5000
```

If OAuth credentials are missing, you'll see:
```
⚠️  Google OAuth credentials not found. OAuth login will be disabled.
   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file to enable OAuth.
```

The server will still start successfully.

## ✅ Verification Steps

### 1. Backend Starts Successfully
```powershell
cd backend
npm run dev
```
- ✅ Server should start on port 5000
- ✅ No crashes or errors

### 2. OAuth Route Test (without credentials)
Without OAuth configured, accessing `/api/auth/google` should return:
```json
{
  "error": "OAuth is not configured",
  "message": "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables"
}
```

### 3. OAuth Flow Test (with credentials)
1. Start backend: `npm run dev`
2. Start frontend: `cd ../frontend && npm run dev`
3. Navigate to: `http://localhost:3000`
4. Click "Login with Google"
5. ✅ Should redirect to Google consent screen
6. ✅ After consent, should redirect to dashboard

## 📝 Important URLs

- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000
- **OAuth Initiate**: http://localhost:5000/api/auth/google
- **OAuth Callback**: http://localhost:5000/api/auth/google/callback (auto-used by Google)
- **Current User**: http://localhost:5000/api/auth/me (requires auth)

## 🔍 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Server crashes on start | Check DATABASE_URL is set correctly |
| "OAuth is not configured" | Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env |
| "redirect_uri_mismatch" | Verify redirect URI in Google Console matches exactly: `http://localhost:5000/api/auth/google/callback` |
| "access_denied" | Add your Google account as test user (External apps) or use Internal app type |
| Session not persisting | Check SESSION_SECRET is set and consistent |

## 📚 Detailed Guide

See `backend/GOOGLE_OAUTH_SETUP.md` for complete setup instructions with screenshots guidance.
