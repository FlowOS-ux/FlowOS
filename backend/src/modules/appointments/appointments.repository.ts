/**
 * FlowOS - src/modules/appointments/appointments.repository.ts
 * Data-access layer for appointments.
 */
import { Appointment, type AppointmentDoc } from '../../models';

export const appointmentsRepository = {
  create(data: Record<string, unknown>): Promise<AppointmentDoc> {
    return Appointment.create(data);
  },

  findById(id: string): Promise<AppointmentDoc | null> {
    return Appointment.findById(id).exec();
  },

  listByUser(userId: string): Promise<AppointmentDoc[]> {
    return Appointment.find({ userId }).sort({ scheduledFor: 1 }).exec();
  },

  listByBusiness(businessId: string): Promise<AppointmentDoc[]> {
    return Appointment.find({ businessId }).sort({ scheduledFor: 1 }).exec();
  },

  updateById(id: string, update: Record<string, unknown>): Promise<AppointmentDoc | null> {
    return Appointment.findByIdAndUpdate(id, update, { new: true }).exec();
  },
};
