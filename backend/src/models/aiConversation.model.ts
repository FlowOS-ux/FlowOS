/**
 * FlowOS - src/models/aiConversation.model.ts
 * AI Assistant chat history for a user (used to maintain context across messages).
 * Collection: aiConversations
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

export type AiConversationDoc = HydratedDocument<InferSchemaType<typeof aiConversationSchema>>;
export const AiConversation = model('AiConversation', aiConversationSchema, 'aiConversations');
