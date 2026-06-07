/**
 * FlowOS - src/modules/ai/ai.service.ts
 * AI assistant chat. Loads/creates a conversation, sends history to the Groq-backed
 * assistant (behind the IAssistant interface), and persists both turns.
 */
import { aiRepository } from './ai.repository';
import { assistant } from '../../container';
import { NotFoundError } from '../../lib/errors';
import type { ChatMessage } from '../../services/ai/assistant.interface';
import type { AiConversationDoc } from '../../models';
import type { ChatDto } from './ai.schema';

function toMessageList(doc: AiConversationDoc): ChatMessage[] {
  return (doc.messages as unknown as ChatMessage[]).map((m) => ({ role: m.role, content: m.content }));
}

export const aiService = {
  async chat(userId: string, dto: ChatDto) {
    let conversation = dto.conversationId
      ? await aiRepository.findByIdForUser(dto.conversationId, userId)
      : null;
    if (dto.conversationId && !conversation) throw new NotFoundError('Conversation not found');
    if (!conversation) {
      conversation = await aiRepository.create(userId, dto.message.slice(0, 60));
    }

    const history = toMessageList(conversation);
    const reply = await assistant.chat([...history, { role: 'user', content: dto.message }]);

    await aiRepository.appendMessages(conversation.id, [
      { role: 'user', content: dto.message },
      { role: 'assistant', content: reply },
    ]);

    return { conversationId: conversation.id as string, reply };
  },

  async listConversations(userId: string) {
    const list = await aiRepository.listByUser(userId);
    return list.map((c) => ({ id: c.id as string, title: c.title ?? null, updatedAt: c.updatedAt }));
  },

  async getConversation(userId: string, id: string) {
    const conversation = await aiRepository.findByIdForUser(id, userId);
    if (!conversation) throw new NotFoundError('Conversation not found');
    return {
      id: conversation.id as string,
      title: conversation.title ?? null,
      messages: conversation.messages,
    };
  },
};
