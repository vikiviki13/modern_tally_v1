import { Request, Response, NextFunction } from 'express';
import { verifyTokenPayload } from './crypto';
import { db } from '../db/store';
import { UserRecord, TenantRecord } from '../db/types';

export const JWT_SECRET = process.env.JWT_SECRET || 'ledgerpulse_dev_financial_jwt_secret_2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRecord['role'];
  tenantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tenant?: TenantRecord;
  token?: string;
}

/**
 * Authentication Middleware: Validates Bearer token and sets request context.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required to access this resource.',
      },
    });
    return;
  }

  // 1. Verify cryptographic token signature & expiration
  const { valid, payload, error } = verifyTokenPayload<{ userId: string; tenantId: string }>(token, JWT_SECRET);

  if (!valid || !payload) {
    // Check if session exists in DB before rejecting
    const session = db.findSessionByToken(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED_OR_INVALID',
          message: error || 'Session expired or token is invalid. Please sign in again.',
        },
      });
      return;
    }
  }

  const userId = payload?.userId || db.findSessionByToken(token)?.userId;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'User identity could not be resolved from token.',
      },
    });
    return;
  }

  // 2. Resolve user from database
  const user = db.findUserById(userId);
  if (!user || !user.isActive) {
    res.status(401).json({
      success: false,
      error: {
        code: 'USER_INACTIVE_OR_DELETED',
        message: 'User account is deactivated or no longer exists.',
      },
    });
    return;
  }

  // 3. Resolve tenant organization
  const tenant = db.findTenantById(user.tenantId);
  if (!tenant) {
    res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant organization associated with user not found.',
      },
    });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
  };
  req.tenant = tenant;
  req.token = token;

  next();
}

/**
 * Role-Based Authorization Guard Middleware
 */
export function requireRole(allowedRoles: UserRecord['role'][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        },
      });
      return;
    }

    next();
  };
}
