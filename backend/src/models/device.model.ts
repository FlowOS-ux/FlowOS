/**
 * FlowOS - src/models/device.model.ts
 * Registered FCM push token for a user's device.
 * Model: DeviceToken | Collection: deviceTokens
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['IOS', 'ANDROID', 'WEB'], default: 'ANDROID' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type DeviceTokenDoc = HydratedDocument<InferSchemaType<typeof deviceTokenSchema>>;
export const DeviceToken = model('DeviceToken', deviceTokenSchema, 'deviceTokens');
