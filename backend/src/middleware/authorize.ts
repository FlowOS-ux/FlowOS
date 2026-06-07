/**
 * FlowOS - src/middleware/authorize.ts
 * RBAC guard for global platform roles. Business-scoped permission checks
 * (OWNER/MANAGER/STAFF of a specific business) live in the staff service via
 * the requireBusinessRole helper, since they need a DB lookup.
 */
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import type { Role } from '../types';

export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
