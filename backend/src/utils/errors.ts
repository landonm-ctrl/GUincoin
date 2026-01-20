import { Prisma } from '@prisma/client';

export interface AppErrorOptions {
  expose?: boolean;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly expose: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.expose = options?.expose ?? statusCode < 500;
    this.code = options?.code;
    this.details = options?.details;

    if (options?.cause instanceof Error) {
      this.cause = options.cause;
    }
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

export const normalizePrismaError = (
  error: Prisma.PrismaClientKnownRequestError
): AppError => {
  switch (error.code) {
    case 'P2002':
      return new AppError('Resource already exists', 409, {
        code: error.code,
        details: error.meta,
      });
    case 'P2025':
      return new AppError('Record not found', 404, {
        code: error.code,
        details: error.meta,
      });
    default:
      return new AppError('Database error', 400, {
        code: error.code,
        details: error.meta,
        expose: process.env.NODE_ENV === 'development',
      });
  }
};

export const asAppError = (error: Error & { status?: number; code?: string }) =>
  new AppError(error.message, error.status ?? 500, {
    code: error.code,
    expose: (error.status ?? 500) < 500,
    cause: error,
  });
