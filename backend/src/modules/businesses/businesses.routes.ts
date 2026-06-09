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
  rejectBusinessSchema,
  exploreQuerySchema,
  businessIdParam,
} from './businesses.schema';

const router = Router();

// Public discovery (auth optional — lets us personalize later).
router.get('/', optionalAuthenticate, validate({ query: exploreQuerySchema }), controller.explore);

// Businesses owned by the current user (must come before "/:id").
router.get('/mine', authenticate, controller.listMine);

// Admin: businesses awaiting verification (must come before "/:id").
router.get('/pending', authenticate, authorize('PLATFORM_ADMIN'), controller.listPending);

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
router.delete('/:id', authenticate, validate({ params: businessIdParam }), controller.remove);

// ---- Verification lifecycle ----

// Owner: submit a DRAFT/REJECTED business for admin review (service checks role).
router.post(
  '/:id/submit',
  authenticate,
  validate({ params: businessIdParam }),
  controller.submitForReview,
);

// Admin: approve / reject a pending business.
router.post(
  '/:id/approve',
  authenticate,
  authorize('PLATFORM_ADMIN'),
  validate({ params: businessIdParam }),
  controller.approve,
);
router.post(
  '/:id/reject',
  authenticate,
  authorize('PLATFORM_ADMIN'),
  validate({ params: businessIdParam, body: rejectBusinessSchema }),
  controller.reject,
);

export default router;
