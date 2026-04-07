import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {
        // JSON output in production
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'secret', 'token'],
          censor: '[REDACTED]',
        },
      }
    : {
        // Pretty output in development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;
