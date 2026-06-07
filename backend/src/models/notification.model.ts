/**
 * FlowOS - src/models/notification.model.ts
 * In-app notification record. Written by the notification service; read by the
 * Notifications screen (and mirrored to FCM push when devices are registered).
 * Collection: notifications
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { NOTIFICATION_TYPES } from '../types';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'GENERIC' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed }, // arbitrary payload (e.g. { queueId, entryId })
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export type NotificationDoc = HydratedDocument<InferSchemaType<typeof notificationSchema>>;
export const Notification = model('Notification', notificationSchema, 'notifications');
