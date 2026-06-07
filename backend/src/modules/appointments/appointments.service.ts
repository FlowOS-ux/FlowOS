/**
 * FlowOS - src/modules/appointments/appointments.service.ts
 * Booking, listing, rescheduling, and cancelling appointments.
 */
import { appointmentsRepository } from './appointments.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { AnalyticsEvent, type AppointmentDoc } from '../../models';
import { assertBusinessRole } from '../../lib/businessAccess';
import { notifications } from '../../container';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Role } from '../../types';
import type { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.schema';

function toPublic(a: AppointmentDoc) {
  return {
    id: a.id as string,
    businessId: String(a.businessId),
    queueId: a.queueId ? String(a.queueId) : null,
    userId: String(a.userId),
    scheduledFor: a.scheduledFor,
    durationSec: a.durationSec,
    status: a.status,
    notes: a.notes ?? null,
    createdAt: a.createdAt,
  };
}

export const appointmentsService = {
  async book(userId: string, dto: CreateAppointmentDto) {
    const business = await businessesRepository.findById(dto.businessId);
    if (!business) throw new NotFoundError('Business not found');
    if (dto.scheduledFor.getTime() < Date.now()) {
      throw new BadRequestError('Appointment time must be in the future');
    }

    const appointment = await appointmentsRepository.create({
      businessId: dto.businessId,
      queueId: dto.queueId,
      userId,
      scheduledFor: dto.scheduledFor,
      durationSec: dto.durationSec,
      notes: dto.notes,
      status: 'BOOKED',
    });

    try {
      await AnalyticsEvent.create({
        type: 'APPOINTMENT_BOOKED',
        businessId: dto.businessId,
        userId,
      } as Record<string, unknown>);
    } catch (err) {
      logger.error({ err }, 'failed to log appointment analytics');
    }

    await notifications.notify(userId, {
      type: 'APPOINTMENT_REMINDER',
      title: 'Appointment booked',
      body: `Your appointment at ${business.name} is confirmed for ${dto.scheduledFor.toLocaleString()}.`,
      data: { appointmentId: appointment.id, businessId: dto.businessId },
    });

    return toPublic(appointment);
  },

  async listMine(userId: string) {
    const list = await appointmentsRepository.listByUser(userId);
    return list.map(toPublic);
  },

  async listForBusiness(userId: string, role: Role, businessId: string) {
    await assertBusinessRole(userId, businessId, 'STAFF', role);
    const list = await appointmentsRepository.listByBusiness(businessId);
    return list.map(toPublic);
  },

  /** The customer who booked, or business staff, may modify an appointment. */
  async update(userId: string, role: Role, id: string, dto: UpdateAppointmentDto) {
    const appt = await appointmentsRepository.findById(id);
    if (!appt) throw new NotFoundError('Appointment not found');

    const isOwner = String(appt.userId) === userId;
    if (!isOwner) await assertBusinessRole(userId, String(appt.businessId), 'STAFF', role);

    if (dto.scheduledFor && dto.scheduledFor.getTime() < Date.now()) {
      throw new BadRequestError('Appointment time must be in the future');
    }

    const updated = await appointmentsRepository.updateById(id, dto);
    return toPublic(updated!);
  },

  async cancel(userId: string, role: Role, id: string) {
    const appt = await appointmentsRepository.findById(id);
    if (!appt) throw new NotFoundError('Appointment not found');

    const isOwner = String(appt.userId) === userId;
    if (!isOwner) await assertBusinessRole(userId, String(appt.businessId), 'STAFF', role);
    if (['CANCELLED', 'COMPLETED'].includes(appt.status)) {
      throw new BadRequestError('Appointment can no longer be cancelled');
    }

    const updated = await appointmentsRepository.updateById(id, { status: 'CANCELLED' });
    return toPublic(updated!);
  },
};
