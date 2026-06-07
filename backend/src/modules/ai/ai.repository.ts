/**
 * FlowOS - src/modules/ai/ai.repository.ts
 * Data-access for AI assistant conversation history.
 */
import { AiConversation, type AiConversationDoc } from '../../models';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const aiRepository = {
  create(userId: string, title: string): Promise<AiConversationDoc> {
    return AiConversation.create({ userId, title, messages: [] });
  },

  findByIdForUser(id: string, userId: string): Promise<AiConversationDoc | null> {
    return AiConversation.findOne({ _id: id, userId }).exec();
  },

  listByUser(userId: string): Promise<AiConversationDoc[]> {
    return AiConversation.find({ userId }).sort({ updatedAt: -1 }).select('title updatedAt').exec();
  },

  appendMessages(id: string, messages: Message[]): Promise<AiConversationDoc | null> {
    return AiConversation.findByIdAndUpdate(
      id,
      { $push: { messages: { $each: messages } } },
      { new: true },
    ).exec();
  },
};
