import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    isManager: boolean;
  };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireManager = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.isManager) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // For now, we'll use a simple check. Can be enhanced with a role system later
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Assuming admin is determined by email or a separate flag
  // This can be customized based on requirements
  next();
};
