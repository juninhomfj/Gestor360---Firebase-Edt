
import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-wa-module-key'];
  if (key !== process.env.WA_MODULE_KEY) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
};
