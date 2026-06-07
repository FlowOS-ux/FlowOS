/**
 * FlowOS - src/modules/entries/entries.routes.ts
 * Two routers:
 *  - queueEntriesRouter: mounted at /queues/:queueId (join, operator list, call-next)
 *  - default router:      mounted at /entries (my entries, leave, serve/complete/no-show)
 * All routes require authentication.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './entries.controller';
import { queueIdParam, entryIdParam } from './entries.schema';

// /queues/:queueId
export const queueEntriesRouter = Router({ mergeParams: true });
queueEntriesRouter.use(authenticate);
queueEntriesRouter.post('/join', validate({ params: queueIdParam }), controller.join);
queueEntriesRouter.get('/entries', validate({ params: queueIdParam }), controller.listForQueue);
queueEntriesRouter.post('/call-next', validate({ params: queueIdParam }), controller.callNext);

// /entries
const router = Router();
router.use(authenticate);
router.get('/me', controller.myEntries);
router.delete('/:id', validate({ params: entryIdParam }), controller.leave);
router.post('/:id/serve', validate({ params: entryIdParam }), controller.startServing);
router.post('/:id/complete', validate({ params: entryIdParam }), controller.complete);
router.post('/:id/no-show', validate({ params: entryIdParam }), controller.noShow);

export default router;
