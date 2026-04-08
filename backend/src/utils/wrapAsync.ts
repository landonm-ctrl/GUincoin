import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to forward errors to Express error handler
 */
export const wrapAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
