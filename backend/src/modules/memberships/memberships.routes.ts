/**
 * FlowOS - src/modules/memberships/memberships.routes.ts
 * Staff routes:
 *  - businessStaffRouter: /businesses/:businessId/staff (list, add)
 *  - default router:       /memberships (update role, remove)
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './memberships.controller';
import { addStaffSchema, updateStaffSchema, businessIdParam, idParam } from './memberships.schema';

// /businesses/:businessId/staff
export const businessStaffRouter = Router({ mergeParams: true });
businessStaffRouter.use(authenticate);
businessStaffRouter.get('/', validate({ params: businessIdParam }), controller.list);
businessStaffRouter.post(
  '/',
  validate({ params: businessIdParam, body: addStaffSchema }),
  controller.add,
);

// /memberships
const router = Router();
router.use(authenticate);
router.patch('/:id', validate({ params: idParam, body: updateStaffSchema }), controller.updateRole);
router.delete('/:id', validate({ params: idParam }), controller.remove);

export default router;
