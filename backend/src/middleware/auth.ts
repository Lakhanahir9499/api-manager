import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface AdminSession {
  isAdmin: boolean;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      adminSession?: AdminSession;
    }
  }
}

let cachedHash: string | null = null;

async function getAdminHash(): Promise<string> {
  if (cachedHash) return cachedHash;
  const bcrypt = await import('bcryptjs');
  cachedHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  return cachedHash;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = await getAdminHash();
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

export function generateAdminToken(): string {
  return jwt.sign({ isAdmin: true }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(): string {
  return jwt.sign({ isAdmin: true, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAdminToken(token: string): AdminSession | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AdminSession;
  } catch {
    return null;
  }
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const session = verifyAdminToken(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.adminSession = session;
  next();
}

export function optionalAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token;
  if (token) {
    const session = verifyAdminToken(token);
    if (session) req.adminSession = session;
  }
  next();
}