/**
 * FlowOS - src/modules/analytics/analytics.routes.ts
 * Business analytics routes (staff-scoped). Mounted at
 * /businesses/:businessId/analytics.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as controller from './analytics.controller';

const businessIdParam = z.object({ businessId: z.string().length(24) });

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/summary', validate({ params: businessIdParam }), controller.summary);
router.get('/', validate({ params: businessIdParam }), controller.detailed);

export default router;
