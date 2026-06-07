/**
 * FlowOS - src/modules/users/users.routes.ts
 * User profile/settings routes. All require authentication.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './users.controller';
import { updateProfileSchema, updateSettingsSchema } from './users.schema';

const router = Router();

router.use(authenticate);

router.get('/me', controller.getMe);
router.patch('/me', validate({ body: updateProfileSchema }), controller.updateMe);
router.get('/me/settings', controller.getSettings);
router.patch('/me/settings', validate({ body: updateSettingsSchema }), controller.updateSettings);
router.post('/me/onboarding-complete', controller.completeOnboarding);

export default router;
