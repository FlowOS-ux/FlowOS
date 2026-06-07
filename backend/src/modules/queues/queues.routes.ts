/**
 * FlowOS - src/modules/queues/queues.routes.ts
 * Two routers:
 *  - businessQueuesRouter: mounted at /businesses/:businessId/queues (list + create)
 *  - default router:        mounted at /queues (get + update by id)
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './queues.controller';
import {
  createQueueSchema,
  updateQueueSchema,
  queueIdParam,
  businessIdParam,
} from './queues.schema';

// /businesses/:businessId/queues
export const businessQueuesRouter = Router({ mergeParams: true });
businessQueuesRouter.get(
  '/',
  validate({ params: businessIdParam }),
  controller.listByBusiness,
);
businessQueuesRouter.post(
  '/',
  authenticate,
  validate({ params: businessIdParam, body: createQueueSchema }),
  controller.create,
);

// /queues
const router = Router();
router.get('/:id', validate({ params: queueIdParam }), controller.getOne);
router.patch(
  '/:id',
  authenticate,
  validate({ params: queueIdParam, body: updateQueueSchema }),
  controller.update,
);

export default router;
