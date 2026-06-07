/**
 * FlowOS - src/modules/system/system.routes.ts
 * System routes: health check and public app config.
 */
import { Router } from 'express';
import { health, config } from './system.controller';

const router = Router();

router.get('/health', health);
router.get('/config', config);

export default router;
