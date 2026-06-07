/**
 * FlowOS - src/modules/notifications/notifications.routes.ts
 * Notification feed + device-token routes. All require authentication.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './notifications.controller';
import {
  listQuerySchema,
  idParam,
  registerDeviceSchema,
  deviceTokenParam,
} from './notifications.schema';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: listQuerySchema }), controller.list);
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', validate({ params: idParam }), controller.markRead);

// Device tokens for push.
router.post('/devices', validate({ body: registerDeviceSchema }), controller.registerDevice);
router.delete('/devices/:token', validate({ params: deviceTokenParam }), controller.removeDevice);

export default router;
