/**
 * FlowOS - src/modules/businesses/businesses.routes.ts
 * Business routes. Public read (explore/details); owner-only create/manage.
 */
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './businesses.controller';
import {
  createBusinessSchema,
  updateBusinessSchema,
  exploreQuerySchema,
  businessIdParam,
} from './businesses.schema';

const router = Router();

// Public discovery (auth optional — lets us personalize later).
router.get('/', optionalAuthenticate, validate({ query: exploreQuerySchema }), controller.explore);

// Businesses owned by the current user (must come before "/:id").
router.get('/mine', authenticate, controller.listMine);

router.get('/:id', validate({ params: businessIdParam }), controller.getOne);

// Owner / business management.
router.post(
  '/',
  authenticate,
  authorize('BUSINESS_OWNER', 'PLATFORM_ADMIN'),
  validate({ body: createBusinessSchema }),
  controller.create,
);
router.patch(
  '/:id',
  authenticate,
  validate({ params: businessIdParam, body: updateBusinessSchema }),
  controller.update,
);

export default router;
