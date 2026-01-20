# Deployment Guide

## Railway Deployment

### Prerequisites
1. Railway account
2. Google OAuth credentials
3. SMTP email configuration

### Steps

1. **Create Railway Project**
   - Create a new project on Railway
   - Add PostgreSQL service
   - Add a new service for the Node.js application

2. **Configure Environment Variables**
   Set the following in Railway:
   - `DATABASE_URL` - From PostgreSQL service
   - `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret
   - `GOOGLE_WORKSPACE_DOMAIN` - e.g., `@guinco.com`
   - `SESSION_SECRET` - Random secret string
   - `SMTP_HOST` - Your SMTP server
   - `SMTP_PORT` - SMTP port (usually 587)
   - `SMTP_USER` - SMTP username
   - `SMTP_PASS` - SMTP password
   - `FRONTEND_URL` - Your frontend URL
   - `BACKEND_URL` - Your backend URL (Railway will provide)
   - `UPLOAD_DIR` - `/tmp/uploads` (or persistent volume path)
   - `MAX_FILE_SIZE` - `5242880` (5MB)
   - `NODE_ENV` - `production`

3. **Configure Google OAuth**
   - Add Railway backend URL to authorized redirect URIs:
     `https://your-backend.railway.app/api/auth/google/callback`

4. **Deploy**
   - Connect your Git repository
   - Railway will automatically detect and build the project
   - The backend will be deployed from the `backend` directory

5. **Run Migrations**
   - After first deployment, run migrations:
     ```bash
     railway run cd backend && npm run migrate
     ```

6. **Frontend Deployment**
   - Build the frontend: `cd frontend && npm run build`
   - Serve the `dist` folder from the backend or deploy separately
   - Update `FRONTEND_URL` environment variable

### File Storage
For production, consider using cloud storage (S3, Cloudinary) instead of local filesystem.
Update `fileService.ts` to use cloud storage provider.

### Database Migrations
Migrations are handled via Prisma. Run `npm run migrate` in the backend directory after deployment.

## Local Development

1. Start PostgreSQL (via Docker):
   ```bash
   docker-compose up -d
   ```

2. Set up environment variables in `.env` file

3. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. Run migrations:
   ```bash
   cd backend && npm run migrate
   ```

5. Start backend:
   ```bash
   cd backend && npm run dev
   ```

6. Start frontend:
   ```bash
   cd frontend && npm run dev
   ```

## Notes

- The application uses session-based authentication
- File uploads are stored locally (configure cloud storage for production)
- Email notifications require SMTP configuration
- Manager allotments need to be created manually or via admin script
- Wellness tasks need to be seeded into the database
