import { Server } from 'http';
import logger from '../config/logger';

export function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
