/**
 * FlowOS - src/models/queue.model.ts
 * Queue/service definition belonging to a business.
 * Collection: queues
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { QUEUE_STATUSES } from '../types';

const queueSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: QUEUE_STATUSES, default: 'OPEN', index: true },
    // Average service time per customer (seconds) — drives ETA. Updated from real data.
    avgServiceSec: { type: Number, default: 300 },
    maxCapacity: { type: Number }, // optional cap on concurrent waiting entries
    // Monotonic counter used to assign human-friendly ticket numbers.
    ticketCounter: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type QueueDoc = HydratedDocument<InferSchemaType<typeof queueSchema>>;
export const Queue = model('Queue', queueSchema, 'queues');
