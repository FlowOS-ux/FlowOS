/**
 * FlowOS - src/modules/ai/ai.routes.ts
 * AI assistant routes. All require authentication. Mounted at /ai.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './ai.controller';
import { chatSchema, idParam, recommendSchema } from './ai.schema';

const router = Router();
router.use(authenticate);

// Each call hits the Groq API (real quota/cost), so cap per authenticated USER —
// not per IP — to stop a single account from burning the shared allowance.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.id, // authenticate has already run
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests — try again later' } },
});

router.post('/chat', aiLimiter, validate({ body: chatSchema }), controller.chat);
router.post('/recommend', aiLimiter, validate({ body: recommendSchema }), controller.recommend);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', validate({ params: idParam }), controller.getConversation);

export default router;
