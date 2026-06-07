/**
 * FlowOS - src/modules/queues/queues.repository.ts
 * Data-access layer for queues. Only layer that touches the Queue model.
 */
import { Queue, type QueueDoc } from '../../models';

export const queuesRepository = {
  create(data: Record<string, unknown>): Promise<QueueDoc> {
    return Queue.create(data);
  },

  findById(id: string): Promise<QueueDoc | null> {
    return Queue.findById(id).exec();
  },

  listByBusiness(businessId: string): Promise<QueueDoc[]> {
    return Queue.find({ businessId }).sort({ createdAt: 1 }).exec();
  },

  updateById(id: string, update: Record<string, unknown>): Promise<QueueDoc | null> {
    return Queue.findByIdAndUpdate(id, update, { new: true }).exec();
  },

  deleteByBusinessId(businessId: string): Promise<unknown> {
    return Queue.deleteMany({ businessId }).exec();
  },

  /** Atomically increment and return the next ticket number for a queue. */
  async nextTicketNumber(id: string): Promise<number> {
    const queue = await Queue.findByIdAndUpdate(
      id,
      { $inc: { ticketCounter: 1 } },
      { new: true },
    ).exec();
    return queue?.ticketCounter ?? 1;
  },
};
