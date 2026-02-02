import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  AppError,
  asAppError,
  isAppError,
  normalizePrismaError,
} from '../utils/errors';

const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return normalizePrismaError(error);
  }

  if (error instanceof ZodError) {
    return new AppError('Validation error', 400, {
      code: 'validation_error',
      details: error.flatten(),
      cause: error,
    });
  }

  if (error instanceof Error && 'status' in error) {
    return asAppError(error as Error & { status?: number });
  }

  if (error instanceof Error) {
    return new AppError('Internal server error', 500, {
      expose: false,
      cause: error,
    });
  }

  return new AppError('Internal server error', 500, { expose: false });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const normalizedError = toAppError(err);
  const headerRequestId = req.headers['x-request-id'];
  const requestId = Array.isArray(headerRequestId)
    ? headerRequestId[0]
    : headerRequestId;
  const resolvedRequestId = requestId || randomUUID();
  res.setHeader('x-request-id', resolvedRequestId);

  console.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode: normalizedError.statusCode,
    message: normalizedError.message,
    requestId: resolvedRequestId,
    stack: err instanceof Error ? err.stack : undefined,
  });

  const exposeMessage =
    normalizedError.expose || process.env.NODE_ENV === 'development';

  res.status(normalizedError.statusCode).json({
    error: exposeMessage ? normalizedError.message : 'Internal server error',
    code: normalizedError.code,
    requestId: resolvedRequestId,
    ...(exposeMessage && normalizedError.details
      ? { details: normalizedError.details }
      : {}),
  });
};
