FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd frontend && npm install
RUN cd backend && npm install

# Copy source code
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend (outputs to backend/frontend-dist)
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Generate Prisma client
RUN cd backend && npx prisma generate

WORKDIR /app/backend

EXPOSE 8080

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
