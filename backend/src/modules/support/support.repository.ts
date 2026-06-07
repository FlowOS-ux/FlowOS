/**
 * FlowOS - src/modules/support/support.repository.ts
 * Data-access layer for support tickets.
 */
import { SupportTicket, type SupportTicketDoc } from '../../models';

export const supportRepository = {
  create(data: Record<string, unknown>): Promise<SupportTicketDoc> {
    return SupportTicket.create(data);
  },

  listByUser(userId: string): Promise<SupportTicketDoc[]> {
    return SupportTicket.find({ userId }).sort({ createdAt: -1 }).exec();
  },

  findByIdForUser(id: string, userId: string): Promise<SupportTicketDoc | null> {
    return SupportTicket.findOne({ _id: id, userId }).exec();
  },
};
