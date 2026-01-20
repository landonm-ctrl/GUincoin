# Guincoin Rewards Platform

A self-service employee rewards platform with manager allotments, peer-to-peer transfers, and wellness task workflows.

## Features

- **Manager Allotments**: Managers can award coins to employees within their budget
- **Peer-to-Peer Transfers**: Employees can send coins to peers with period-based limits
- **Wellness Workflow**: Document-verified health tasks with approval workflow
- **Bank-Account Interface**: Full transaction history with pending/posted status
- **Google Workspace Authentication**: Secure login with Google OAuth

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Authentication**: Passport.js with Google OAuth

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Google OAuth credentials

### Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Start PostgreSQL (using Docker Compose):
   ```bash
   docker-compose up -d
   ```
4. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
5. Run database migrations:
   ```bash
   npm run migrate
   ```
6. Start backend server:
   ```bash
   npm run dev
   ```
7. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
8. Start frontend dev server:
   ```bash
   npm run dev
   ```

### Railway Deployment

1. Create a new Railway project
2. Add PostgreSQL service
3. Add environment variables from `.env.example`
4. Connect your repository
5. Deploy!

## Project Structure

```
guincoin-platform/
├── backend/          # Express API server
├── frontend/         # React SPA
├── uploads/          # Wellness document storage
└── README.md
```

## License

ISC
