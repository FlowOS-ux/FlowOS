/**
 * FlowOS - src/modules/reviews/reviews.routes.ts
 * Reviews routes:
 *  - businessReviewsRouter: /businesses/:businessId/reviews (public list, create)
 *  - default router:        /reviews (update, delete own review)
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './reviews.controller';
import {
  createReviewSchema,
  updateReviewSchema,
  businessIdParam,
  idParam,
} from './reviews.schema';

// /businesses/:businessId/reviews
export const businessReviewsRouter = Router({ mergeParams: true });
businessReviewsRouter.get('/', validate({ params: businessIdParam }), controller.listForBusiness);
businessReviewsRouter.post(
  '/',
  authenticate,
  validate({ params: businessIdParam, body: createReviewSchema }),
  controller.create,
);

// /reviews
const router = Router();
router.use(authenticate);
router.patch('/:id', validate({ params: idParam, body: updateReviewSchema }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.remove);

export default router;
