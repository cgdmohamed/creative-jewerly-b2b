import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findUserById, type ShopUser } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      shopUser?: ShopUser;
    }
  }
}

export function signShopToken(user: { id: number }): string {
  return jwt.sign({ sub: user.id }, config.shopJwtSecret, { expiresIn: '7d' });
}

export function authenticateShop(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'auth.required' });
  try {
    const payload = jwt.verify(header.slice(7), config.shopJwtSecret) as jwt.JwtPayload;
    const user = findUserById(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'auth.required' });
    req.shopUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'auth.required' });
  }
}

export function optionalShopAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.shopJwtSecret) as jwt.JwtPayload;
      const user = findUserById(Number(payload.sub));
      if (user) req.shopUser = user;
    } catch {
      // ignore invalid token; treat as anonymous
    }
  }
  next();
}

// ---- staff admin auth ----
// Staff authenticate against the main system (employee login); on success the
// shop issues its own admin token. `requireAdmin` only accepts shop admin
// tokens, never customer tokens.
export interface ShopAdmin {
  employeeId: number;
  fullName: string;
  roleCode: string;
}

export function signAdminToken(admin: ShopAdmin): string {
  return jwt.sign({ role: 'shop-admin', ...admin }, config.shopJwtSecret, { expiresIn: '12h' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'auth.required' });
  try {
    const payload = jwt.verify(header.slice(7), config.shopJwtSecret) as jwt.JwtPayload;
    if (payload.role !== 'shop-admin' || !payload.employeeId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    (req as any).admin = {
      employeeId: payload.employeeId,
      fullName: payload.fullName,
      roleCode: payload.roleCode,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'auth.required' });
  }
}
