/**
 * FlowOS - src/modules/ai/ai.routes.ts
 * AI assistant routes. All require authentication. Mounted at /ai.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './ai.controller';
import { chatSchema, idParam } from './ai.schema';

const router = Router();
router.use(authenticate);

router.post('/chat', validate({ body: chatSchema }), controller.chat);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', validate({ params: idParam }), controller.getConversation);

export default router;
