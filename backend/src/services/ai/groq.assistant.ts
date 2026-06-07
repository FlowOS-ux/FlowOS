/**
 * FlowOS - src/services/ai/groq.assistant.ts
 * AI assistant backed by the Groq API. If GROQ_API_KEY is absent, returns a helpful
 * fallback so the assistant screen degrades gracefully instead of erroring.
 */
import Groq from 'groq-sdk';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { ChatMessage, IAssistant } from './assistant.interface';

const DEFAULT_SYSTEM =
  'You are FlowOS Assistant, a helpful guide for a virtual queue management app. ' +
  'Help users find businesses, understand their queue position and wait time, book ' +
  'appointments, and answer FAQs. Be concise and friendly.';

export class GroqAssistant implements IAssistant {
  private client: Groq | null = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

  async chat(messages: ChatMessage[], system?: string): Promise<string> {
    if (!this.client) {
      return "The AI assistant isn't configured yet. Please set GROQ_API_KEY to enable it.";
    }
    try {
      const completion = await this.client.chat.completions.create({
        model: env.GROQ_MODEL,
        messages: [{ role: 'system', content: system ?? DEFAULT_SYSTEM }, ...messages],
        temperature: 0.5,
        max_tokens: 600,
      });
      return completion.choices[0]?.message?.content ?? '';
    } catch (err) {
      logger.error({ err }, 'Groq chat failed');
      return 'Sorry, I had trouble responding just now. Please try again.';
    }
  }
}
