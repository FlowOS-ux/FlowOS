/**
 * FlowOS - src/modules/analytics/analytics.service.ts
 * Dashboard summary + deeper business analytics. Access is staff-scoped.
 */
import { analyticsRepository } from './analytics.repository';
import { assertBusinessRole } from '../../lib/businessAccess';
import type { Role } from '../../types';

function sinceDays(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const analyticsService = {
  /** Quick "today" snapshot for the Business Dashboard. */
  async summary(userId: string, role: Role, businessId: string) {
    await assertBusinessRole(userId, businessId, 'STAFF', role);
    const since = sinceDays(1);

    const [counts, avgWait, waiting] = await Promise.all([
      analyticsRepository.eventCounts(businessId, since),
      analyticsRepository.avgWaitSec(businessId, since),
      analyticsRepository.currentlyWaiting(businessId),
    ]);

    const completed = counts.QUEUE_COMPLETED ?? 0;
    const noShows = counts.QUEUE_NO_SHOW ?? 0;
    return {
      rangeHours: 24,
      joined: counts.QUEUE_JOIN ?? 0,
      completed,
      noShows,
      currentlyWaiting: waiting,
      avgWaitSec: avgWait,
      noShowRate: completed + noShows > 0 ? Math.round((noShows / (completed + noShows)) * 100) : 0,
    };
  },

  /** Richer analytics over a window (default 7 days) for the Analytics screen. */
  async detailed(userId: string, role: Role, businessId: string, days: number) {
    await assertBusinessRole(userId, businessId, 'STAFF', role);
    const since = sinceDays(days);

    const [counts, avgWait, throughput, peak] = await Promise.all([
      analyticsRepository.eventCounts(businessId, since),
      analyticsRepository.avgWaitSec(businessId, since),
      analyticsRepository.throughputByDay(businessId, since),
      analyticsRepository.peakHours(businessId, since),
    ]);

    const completed = counts.QUEUE_COMPLETED ?? 0;
    const noShows = counts.QUEUE_NO_SHOW ?? 0;
    return {
      rangeDays: days,
      totals: {
        joined: counts.QUEUE_JOIN ?? 0,
        completed,
        cancelled: counts.QUEUE_LEAVE ?? 0,
        noShows,
        appointmentsBooked: counts.APPOINTMENT_BOOKED ?? 0,
        reviews: counts.REVIEW_CREATED ?? 0,
      },
      avgWaitSec: avgWait,
      noShowRate: completed + noShows > 0 ? Math.round((noShows / (completed + noShows)) * 100) : 0,
      throughputByDay: throughput,
      peakHours: peak,
    };
  },
};
