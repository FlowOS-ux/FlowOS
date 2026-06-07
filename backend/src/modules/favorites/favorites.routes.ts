/**
 * FlowOS - src/modules/favorites/favorites.routes.ts
 * Saved-places routes. All require authentication. Mounted at /favorites.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './favorites.controller';
import { addFavoriteSchema, businessIdParam } from './favorites.schema';

const router = Router();
router.use(authenticate);

router.get('/me', controller.listMine);
router.post('/', validate({ body: addFavoriteSchema }), controller.add);
router.delete('/:businessId', validate({ params: businessIdParam }), controller.remove);

export default router;
