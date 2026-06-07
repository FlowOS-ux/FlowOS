/**
 * FlowOS - src/modules/analytics/analytics.repository.ts
 * Aggregation queries over analyticsEvents + queueEntries for dashboards.
 */
import { Types } from 'mongoose';
import { AnalyticsEvent, QueueEntry } from '../../models';

const oid = (id: string) => new Types.ObjectId(id);

export const analyticsRepository = {
  /** Counts of each event type for a business since `since`. */
  async eventCounts(businessId: string, since: Date): Promise<Record<string, number>> {
    const rows = await AnalyticsEvent.aggregate<{ _id: string; count: number }>([
      { $match: { businessId: oid(businessId), createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  },

  /** Average wait (durationSec) of completed entries for a business since `since`. */
  async avgWaitSec(businessId: string, since: Date): Promise<number> {
    const rows = await AnalyticsEvent.aggregate<{ avg: number }>([
      {
        $match: {
          businessId: oid(businessId),
          type: 'QUEUE_COMPLETED',
          createdAt: { $gte: since },
          durationSec: { $gt: 0 },
        },
      },
      { $group: { _id: null, avg: { $avg: '$durationSec' } } },
    ]);
    return rows[0] ? Math.round(rows[0].avg) : 0;
  },

  /** Currently WAITING entries across the business. */
  currentlyWaiting(businessId: string): Promise<number> {
    return QueueEntry.countDocuments({ businessId, status: 'WAITING' }).exec();
  },

  /** Throughput (completed) grouped by day for the last `days` days. */
  throughputByDay(businessId: string, since: Date): Promise<{ day: string; count: number }[]> {
    return AnalyticsEvent.aggregate([
      { $match: { businessId: oid(businessId), type: 'QUEUE_COMPLETED', createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: '$_id', count: 1 } },
    ]).exec() as unknown as Promise<{ day: string; count: number }[]>;
  },

  /** Join distribution by hour-of-day (0-23) — reveals peak hours. */
  peakHours(businessId: string, since: Date): Promise<{ hour: number; count: number }[]> {
    return AnalyticsEvent.aggregate([
      { $match: { businessId: oid(businessId), type: 'QUEUE_JOIN', createdAt: { $gte: since } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', count: 1 } },
    ]).exec() as unknown as Promise<{ hour: number; count: number }[]>;
  },
};
