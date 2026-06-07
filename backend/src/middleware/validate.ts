/**
 * FlowOS - src/middleware/validate.ts
 * Generic zod validation middleware. Validates and replaces req.body/params/query
 * with parsed (typed, coerced) values. On failure -> 422 ValidationError.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors';

interface ValidateSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidateSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        // Express 5: req.query is a read-only getter — assign onto a stashed field instead.
        const parsedQuery = schemas.query.parse(req.query);
        Object.defineProperty(req, 'validatedQuery', { value: parsedQuery, configurable: true });
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError('Validation failed', err.issues));
        return;
      }
      next(err);
    }
  };
}
