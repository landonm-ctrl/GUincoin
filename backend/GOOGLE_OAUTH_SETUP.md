# Google OAuth 2.0 Setup Guide

This guide walks you through setting up Google OAuth 2.0 for local development of the Guincoin backend.

## Overview

The backend uses Google OAuth 2.0 for authentication. The OAuth flow works as follows:
1. User clicks "Login with Google" on the frontend
2. User is redirected to Google's consent screen
3. After consent, Google redirects to: `http://localhost:5000/api/auth/google/callback`
4. Backend processes the OAuth callback and creates/logs in the user
5. User is redirected to: `http://localhost:3000/dashboard`

## Google Cloud Console Setup

### Step 1: Create/Select a Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project name/ID

### Step 2: Enable Google+ API (if needed)

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google+ API" (or "Google Identity")
3. Click **Enable** if not already enabled

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Choose user type:
   - **Internal**: Only users in your Google Workspace organization can sign in
   - **External**: Any Google user can sign in (requires verification for production)
   - For local dev, either works, but **Internal** is simpler if you have a Workspace

3. Fill in the required fields:
   - **App name**: Guincoin Rewards Platform (or any name)
   - **User support email**: Your email
   - **Developer contact information**: Your email

4. Click **Save and Continue**

5. **Scopes** (Step 2):
   - Click **Add or Remove Scopes**
   - Select the following scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
   - Click **Update**, then **Save and Continue**

6. **Test users** (Step 3 - if using External):
   - Add your test Google account email(s)
   - Click **Save and Continue**

7. **Summary** (Step 4):
   - Review and click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Client ID

1. Navigate to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen first (see Step 3)
4. Select application type: **Web application**
5. Name: `Guincoin Local Dev` (or any name)
6. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://localhost:5000
   ```
   - Add both URLs (one per line or separate entries)
   - Frontend runs on port 3000
   - Backend runs on port 5000 (for CORS)

7. **Authorized redirect URIs**:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
   - This is the exact callback path used by the backend
   - The path is: `/api/auth/google/callback`

8. Click **CREATE**

9. **Save the credentials**:
   - A dialog will appear with your **Client ID** and **Client secret**
   - Copy both values immediately (secret is only shown once)
   - Format:
     - Client ID: `xxxxx.apps.googleusercontent.com`
     - Client secret: `GOCSPX-xxxxx`

### Step 5: Configure Environment Variables

1. Copy `backend/.env.example` to `backend/.env`:
   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

2. Edit `backend/.env` and set the OAuth values:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
   BACKEND_URL=http://localhost:5000
   FRONTEND_URL=http://localhost:3000
   SESSION_SECRET=generate-a-random-secret-here
   ```

3. **Optional**: Set `GOOGLE_WORKSPACE_DOMAIN` to restrict login to your organization:
   ```env
   GOOGLE_WORKSPACE_DOMAIN=yourcompany.com
   ```
   - If set, only emails ending with this domain can log in
   - Leave unset to allow any Google account

4. Generate a secure `SESSION_SECRET`:
   ```powershell
   # PowerShell one-liner to generate a random string
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
   ```
   Or use an online generator: https://generate-secret.vercel.app/32

## Verification Steps

### 1. Verify Backend Starts

```powershell
cd backend
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

The server will still start, but OAuth routes will return 503 errors.

### 2. Verify OAuth Routes

With OAuth configured, test the routes:

1. **Initiate OAuth flow** (opens Google consent screen):
   ```
   http://localhost:5000/api/auth/google
   ```
   - Should redirect to Google's login/consent page

2. **Callback endpoint** (called by Google after consent):
   ```
   http://localhost:5000/api/auth/google/callback
   ```
   - Direct access will fail (requires OAuth state)
   - Used automatically by the OAuth flow

3. **Current user endpoint** (requires authentication):
   ```powershell
   # This requires a session cookie from OAuth login
   curl http://localhost:5000/api/auth/me
   ```

### 3. Test Full OAuth Flow

1. Start the backend:
   ```powershell
   cd backend
   npm run dev
   ```

2. Start the frontend (in another terminal):
   ```powershell
   cd frontend
   npm run dev
   ```

3. Navigate to `http://localhost:3000`
4. Click "Login with Google"
5. Complete Google authentication
6. Should redirect to dashboard

## Troubleshooting

### "OAuth is not configured" error (503)

- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the backend server after changing `.env`

### "redirect_uri_mismatch" error

- Verify the redirect URI in Google Cloud Console exactly matches:
  ```
  http://localhost:5000/api/auth/google/callback
  ```
- Check for typos, trailing slashes, or HTTP vs HTTPS mismatches
- Wait a few minutes after updating (Google may cache)

### "access_denied" error

- If using **External** OAuth consent screen, ensure your Google account is added as a test user
- Check that the app is in "Testing" mode (not "Published")
- Verify scopes include `email` and `profile`

### CORS errors

- Verify `FRONTEND_URL` in `.env` matches your frontend URL (default: `http://localhost:3000`)
- Ensure backend CORS is configured to allow credentials

### Session not persisting

- Check `SESSION_SECRET` is set and consistent
- Verify cookies are being set (check browser DevTools > Application > Cookies)
- In development, cookies use `httpOnly: true` and `secure: false` (HTTP only)

## Production Notes

For production deployment:
1. Change `NODE_ENV=production` (enables secure cookies)
2. Use HTTPS URLs in `BACKEND_URL` and `FRONTEND_URL`
3. Update Google Cloud Console redirect URIs to production URLs
4. Use a strong, randomly generated `SESSION_SECRET`
5. If using External OAuth, submit for verification before publishing
6. Consider restricting `GOOGLE_WORKSPACE_DOMAIN` to your organization

## Quick Reference

### Required Environment Variables
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-random-secret
```

### OAuth Endpoints
- Initiate: `GET /api/auth/google`
- Callback: `GET /api/auth/google/callback`
- Current user: `GET /api/auth/me` (requires auth)
- Logout: `POST /api/auth/logout`

### OAuth Scopes Used
- `profile` - User's basic profile information
- `email` - User's email address

### Google Cloud Console Settings
- **App Type**: Web application
- **Authorized JavaScript origins**: `http://localhost:3000`, `http://localhost:5000`
- **Authorized redirect URIs**: `http://localhost:5000/api/auth/google/callback`
