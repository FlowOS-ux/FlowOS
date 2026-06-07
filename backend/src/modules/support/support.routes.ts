/**
 * FlowOS - src/modules/support/support.routes.ts
 * Support routes. Articles are public; tickets require authentication.
 * Mounted at /support.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './support.controller';
import { createTicketSchema, idParam } from './support.schema';

const router = Router();

router.get('/articles', controller.articles);

router.post('/tickets', authenticate, validate({ body: createTicketSchema }), controller.createTicket);
router.get('/tickets/me', authenticate, controller.listMine);
router.get('/tickets/:id', authenticate, validate({ params: idParam }), controller.getOne);

export default router;
