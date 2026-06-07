/**
 * FlowOS - src/modules/entries/entries.repository.ts
 * Data-access layer for queue entries. Encapsulates the position-counting and
 * atomic call-next queries that power the queue engine.
 */
import { QueueEntry, type QueueEntryDoc } from '../../models';
import { ACTIVE_ENTRY_STATUSES, type EntryStatus } from '../../types';

export const entriesRepository = {
  create(data: Record<string, unknown>): Promise<QueueEntryDoc> {
    return QueueEntry.create(data);
  },

  findById(id: string): Promise<QueueEntryDoc | null> {
    return QueueEntry.findById(id).exec();
  },

  findActiveByUserAndQueue(userId: string, queueId: string): Promise<QueueEntryDoc | null> {
    return QueueEntry.findOne({ userId, queueId, status: { $in: ACTIVE_ENTRY_STATUSES } }).exec();
  },

  findActiveByUser(userId: string): Promise<QueueEntryDoc[]> {
    return QueueEntry.find({ userId, status: { $in: ACTIVE_ENTRY_STATUSES } })
      .sort({ joinedAt: 1 })
      .exec();
  },

  /** Number of WAITING entries ahead of a given join time = "people ahead". */
  countWaitingAhead(queueId: string, joinedAt: Date): Promise<number> {
    return QueueEntry.countDocuments({
      queueId,
      status: 'WAITING',
      joinedAt: { $lt: joinedAt },
    }).exec();
  },

  countWaiting(queueId: string): Promise<number> {
    return QueueEntry.countDocuments({ queueId, status: 'WAITING' }).exec();
  },

  /** Live operator view: WAITING/CALLED/SERVING entries with basic user info. */
  listActiveByQueue(queueId: string): Promise<QueueEntryDoc[]> {
    return QueueEntry.find({ queueId, status: { $in: ACTIVE_ENTRY_STATUSES } })
      .sort({ joinedAt: 1 })
      .populate('userId', 'name avatarUrl')
      .exec();
  },

  /** Atomically transition the oldest WAITING entry to CALLED (race-safe). */
  callOldestWaiting(queueId: string, calledAt: Date): Promise<QueueEntryDoc | null> {
    return QueueEntry.findOneAndUpdate(
      { queueId, status: 'WAITING' },
      { status: 'CALLED', calledAt },
      { sort: { joinedAt: 1 }, new: true },
    ).exec();
  },

  findFrontWaiting(queueId: string): Promise<QueueEntryDoc | null> {
    return QueueEntry.findOne({ queueId, status: 'WAITING' }).sort({ joinedAt: 1 }).exec();
  },

  updateById(
    id: string,
    status: EntryStatus,
    extra: Record<string, unknown> = {},
  ): Promise<QueueEntryDoc | null> {
    return QueueEntry.findByIdAndUpdate(id, { status, ...extra }, { new: true }).exec();
  },

  markNearNotified(id: string): Promise<unknown> {
    return QueueEntry.findByIdAndUpdate(id, { nearNotified: true }).exec();
  },

  deleteByBusinessId(businessId: string): Promise<unknown> {
    return QueueEntry.deleteMany({ businessId }).exec();
  },
};
