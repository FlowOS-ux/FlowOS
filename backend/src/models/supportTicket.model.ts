/**
 * FlowOS - src/models/supportTicket.model.ts
 * Help & Support ticket raised by a user.
 * Collection: supportTickets
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { SUPPORT_STATUSES } from '../types';

const supportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: { type: String, enum: SUPPORT_STATUSES, default: 'OPEN', index: true },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' },
  },
  { timestamps: true },
);

export type SupportTicketDoc = HydratedDocument<InferSchemaType<typeof supportTicketSchema>>;
export const SupportTicket = model('SupportTicket', supportTicketSchema, 'supportTickets');
