/**
 * FlowOS - src/modules/admin/admin.routes.ts
 * Admin verification dashboard. Mounted at /admin. Every route requires an
 * authenticated PLATFORM_ADMIN (no public access, no business-owner access).
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './admin.controller';
import { businessIdParam, rejectBusinessSchema } from './admin.schema';

const router = Router();

// Gate the whole admin surface behind JWT auth + the PLATFORM_ADMIN role.
router.use(authenticate, authorize('PLATFORM_ADMIN'));

// Verification queues by status.
router.get('/businesses/pending', controller.listPending);
router.get('/businesses/approved', controller.listApproved);
router.get('/businesses/rejected', controller.listRejected);

// Decisions.
router.patch('/businesses/:id/approve', validate({ params: businessIdParam }), controller.approve);
router.patch(
  '/businesses/:id/reject',
  validate({ params: businessIdParam, body: rejectBusinessSchema }),
  controller.reject,
);

export default router;
