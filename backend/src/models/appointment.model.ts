/**
 * FlowOS - src/models/appointment.model.ts
 * Booked appointment for a business (optionally tied to a specific queue/service).
 * Collection: appointments
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { APPOINTMENT_STATUSES } from '../types';

const appointmentSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    queueId: { type: Schema.Types.ObjectId, ref: 'Queue' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scheduledFor: { type: Date, required: true, index: true },
    durationSec: { type: Number, default: 900 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'BOOKED', index: true },
    notes: { type: String },
  },
  { timestamps: true },
);

export type AppointmentDoc = HydratedDocument<InferSchemaType<typeof appointmentSchema>>;
export const Appointment = model('Appointment', appointmentSchema, 'appointments');
