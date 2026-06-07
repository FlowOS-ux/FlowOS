/**
 * FlowOS - src/modules/appointments/appointments.routes.ts
 * Appointment routes. All require authentication.
 *  - default router: /appointments (book, my list, update, cancel)
 *  - businessAppointmentsRouter: /businesses/:businessId/appointments (staff list)
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './appointments.controller';
import { createAppointmentSchema, updateAppointmentSchema, idParam } from './appointments.schema';

// /businesses/:businessId/appointments
export const businessAppointmentsRouter = Router({ mergeParams: true });
businessAppointmentsRouter.use(authenticate);
businessAppointmentsRouter.get('/', controller.listForBusiness);

// /appointments
const router = Router();
router.use(authenticate);
router.post('/', validate({ body: createAppointmentSchema }), controller.book);
router.get('/me', controller.listMine);
router.patch('/:id', validate({ params: idParam, body: updateAppointmentSchema }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.cancel);

export default router;
