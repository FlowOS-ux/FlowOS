/**
 * FlowOS - src/modules/ai/ai.controller.ts
 * HTTP handlers for the AI assistant module.
 */
import type { Request, Response } from 'express';
import { aiService } from './ai.service';
import { recommendService } from './recommend.service';

export async function chat(req: Request, res: Response): Promise<void> {
  const result = await aiService.chat(req.user!.id, req.body);
  res.json(result);
}

/** Natural-language service discovery: ranked, joinable recommendations. */
export async function recommend(req: Request, res: Response): Promise<void> {
  const result = await recommendService.recommend(req.body);
  res.json(result);
}

export async function listConversations(req: Request, res: Response): Promise<void> {
  const conversations = await aiService.listConversations(req.user!.id);
  res.json({ conversations });
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const conversation = await aiService.getConversation(req.user!.id, String(req.params.id));
  res.json({ conversation });
}
