/**
 * FlowOS - src/models/analyticsEvent.model.ts
 * Append-only event log. Powers analytics dashboards and serves as training data
 * for future AI wait-time prediction.
 * Collection: analyticsEvents
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ANALYTICS_EVENT_TYPES = [
  'QUEUE_JOIN',
  'QUEUE_LEAVE',
  'QUEUE_CALLED',
  'QUEUE_SERVING',
  'QUEUE_COMPLETED',
  'QUEUE_NO_SHOW',
  'APPOINTMENT_BOOKED',
  'REVIEW_CREATED',
] as const;

const analyticsEventSchema = new Schema(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
    queueId: { type: Schema.Types.ObjectId, ref: 'Queue', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    // Measured duration where relevant (e.g. wait time, service time) in seconds.
    durationSec: { type: Number },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

analyticsEventSchema.index({ businessId: 1, type: 1, createdAt: -1 });

export type AnalyticsEventDoc = HydratedDocument<InferSchemaType<typeof analyticsEventSchema>>;
export const AnalyticsEvent = model('AnalyticsEvent', analyticsEventSchema, 'analyticsEvents');
