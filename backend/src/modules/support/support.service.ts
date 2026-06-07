/**
 * FlowOS - src/modules/support/support.service.ts
 * Support tickets + static help articles (Help & Support screen).
 */
import { supportRepository } from './support.repository';
import { NotFoundError } from '../../lib/errors';
import type { SupportTicketDoc } from '../../models';
import type { CreateTicketDto } from './support.schema';

const HELP_ARTICLES = [
  { slug: 'join-a-queue', title: 'How do I join a queue?', body: 'Open a business, pick a queue, and tap Join. You can track your live position from the Home or Tracking screen.' },
  { slug: 'notifications', title: 'When will I be notified?', body: 'You receive an alert when you are next in line and again when it is your turn.' },
  { slug: 'appointments', title: 'Booking appointments', body: 'From a business page, choose a time slot to book an appointment. You can reschedule or cancel from the Appointments screen.' },
  { slug: 'business-setup', title: 'Setting up a business', body: 'Register your business, add your queues/services and operating hours, then invite staff to help manage the queue.' },
];

function toPublic(t: SupportTicketDoc) {
  return {
    id: t.id as string,
    subject: t.subject,
    message: t.message,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
  };
}

export const supportService = {
  listArticles() {
    return HELP_ARTICLES;
  },

  async createTicket(userId: string, dto: CreateTicketDto) {
    const ticket = await supportRepository.create({ userId, ...dto, status: 'OPEN' });
    return toPublic(ticket);
  },

  async listMine(userId: string) {
    const tickets = await supportRepository.listByUser(userId);
    return tickets.map(toPublic);
  },

  async getOne(userId: string, id: string) {
    const ticket = await supportRepository.findByIdForUser(id, userId);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return toPublic(ticket);
  },
};
