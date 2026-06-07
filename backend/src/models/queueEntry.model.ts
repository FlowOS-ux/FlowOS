/**
 * FlowOS - src/models/queueEntry.model.ts
 * A customer's ticket within a queue. Transitions through the queue state machine:
 * WAITING -> CALLED -> SERVING -> COMPLETED (with CANCELLED / NO_SHOW branches).
 * Collection: queueEntries
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ENTRY_STATUSES } from '../types';

const queueEntrySchema = new Schema(
  {
    queueId: { type: Schema.Types.ObjectId, ref: 'Queue', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketNumber: { type: Number, required: true },
    status: { type: String, enum: ENTRY_STATUSES, default: 'WAITING', index: true },
    joinedAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    servingAt: { type: Date },
    completedAt: { type: Date },
    servedByStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    // Cached ETA at last computation (seconds); informational.
    estimatedWaitSec: { type: Number },
    // True once a "you're almost up" notification has been sent (prevents spam).
    nearNotified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Fast position counting: entries in a queue by status ordered by join time.
queueEntrySchema.index({ queueId: 1, status: 1, joinedAt: 1 });
// A user's active tickets lookup.
queueEntrySchema.index({ userId: 1, status: 1 });
// Enforce "one active entry per user per queue" at the DB level.
queueEntrySchema.index(
  { queueId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['WAITING', 'CALLED', 'SERVING'] } } },
);

export type QueueEntryDoc = HydratedDocument<InferSchemaType<typeof queueEntrySchema>>;
export const QueueEntry = model('QueueEntry', queueEntrySchema, 'queueEntries');
