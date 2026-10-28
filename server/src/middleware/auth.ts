import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

import { db } from '../db/schema';

/**
 * Validates the short-lived JWT Access Token from the Authorization header.
 * Hardened for Phase 7 Milestone 2 Step 2A:
 * - Checks token signature and expiration.
 * - Verifies user exists in the database.
 * - Rejects suspended users (is_active = 0).
 * - Synchronizes the authenticated user's current database role, ensuring old JWTs cannot bypass role changes.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No authorization token provided.'
    });
  }

  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired access token. Please refresh your session.'
      });
    }

    const payload = decoded as AuthenticatedUser;

    // Database check: verify user existence, active status, and current role
    try {
      const userRecord: any = db.prepare(`
        SELECT id, email, name, role, is_active
        FROM users
        WHERE id = ?
      `).get(payload.id);

      if (!userRecord) {
        return res.status(401).json({
          success: false,
          error: 'User account not found or has been removed.'
        });
      }

      if (userRecord.is_active === 0) {
        return res.status(403).json({
          success: false,
          error: 'Account has been deactivated. Please contact administrator.'
        });
      }

      // Attach authoritative database user information
      req.user = {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        role: userRecord.role as 'STUDENT' | 'INSTRUCTOR' | 'ADMIN'
      };

      next();
    } catch (dbErr: any) {
      return res.status(500).json({
        success: false,
        error: 'Authentication verification failed due to internal error.'
      });
    }
  });
}

/**
 * Server-side Role-Based Access Control (RBAC) middleware.
 * Prevents unauthorized role bypass (Master plan rule: roles validated on server ONLY).
 */
export function requireRole(...allowedRoles: ('STUDENT' | 'INSTRUCTOR' | 'ADMIN')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
}
