import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  /* Fix: Cast req to any to resolve property access error on headers which might be missing in some environments' Request type definitions */
  const key = (req as any).headers['x-wa-module-key'];
  if (key !== process.env.WA_MODULE_KEY) {
    /* Fix: Cast res to any to resolve missing status property error on Response type */
    return (res as any).status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
};