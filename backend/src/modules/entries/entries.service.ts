/**
 * FlowOS - src/modules/entries/entries.service.ts
 * The queue engine. Implements the entry state machine
 *   WAITING -> CALLED -> SERVING -> COMPLETED  (+ CANCELLED / NO_SHOW branches)
 * plus live position/ETA, real-time broadcasts, notifications, and analytics.
 */
import { entriesRepository } from './entries.repository';
import { queuesRepository } from '../queues/queues.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { AnalyticsEvent, type QueueDoc, type QueueEntryDoc } from '../../models';
import { getRealtime } from '../../container';
import { notifications } from '../../container';
import { RT_EVENTS, QUEUE_EVENTS } from '../../services/realtime/realtime.interface';
import { assertBusinessRole } from '../../lib/businessAccess';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Role } from '../../types';

// Notify the front-of-line customer when they are this many people away (or next).
const NEAR_THRESHOLD = 1;

async function logEvent(
  type: string,
  data: {
    businessId?: unknown;
    queueId?: unknown;
    userId?: unknown;
    durationSec?: number;
    payload?: unknown;
  },
): Promise<void> {
  try {
    await AnalyticsEvent.create({ type, ...data } as Record<string, unknown>);
  } catch (err) {
    logger.error({ err, type }, 'failed to log analytics event');
  }
}

function baseEntryView(entry: QueueEntryDoc) {
  return {
    id: entry.id as string,
    queueId: String(entry.queueId),
    businessId: String(entry.businessId),
    ticketNumber: entry.ticketNumber,
    status: entry.status,
    joinedAt: entry.joinedAt,
    calledAt: entry.calledAt ?? null,
    servingAt: entry.servingAt ?? null,
    completedAt: entry.completedAt ?? null,
  };
}

/** Attach live position + ETA for a WAITING entry; static fields otherwise. */
async function withPosition(entry: QueueEntryDoc, queue: QueueDoc) {
  const view = baseEntryView(entry);
  if (entry.status !== 'WAITING') {
    return { ...view, position: entry.status === 'CALLED' ? 0 : null, peopleAhead: 0, estimatedWaitSec: 0 };
  }
  const peopleAhead = await entriesRepository.countWaitingAhead(String(queue.id), entry.joinedAt);
  return {
    ...view,
    peopleAhead,
    position: peopleAhead + 1,
    estimatedWaitSec: peopleAhead * queue.avgServiceSec,
  };
}

async function getQueueOrThrow(queueId: string): Promise<QueueDoc> {
  const queue = await queuesRepository.findById(queueId);
  if (!queue) throw new NotFoundError('Queue not found');
  return queue;
}

/** After the line advances, tell the new front customer they're up next (once). */
async function notifyNextInLine(queue: QueueDoc): Promise<void> {
  const front = await entriesRepository.findFrontWaiting(String(queue.id));
  if (!front || front.nearNotified) return;
  const peopleAhead = await entriesRepository.countWaitingAhead(String(queue.id), front.joinedAt);
  if (peopleAhead > NEAR_THRESHOLD) return;

  await entriesRepository.markNearNotified(front.id as string);
  await notifications.notify(String(front.userId), {
    type: 'POSITION_UPDATE',
    title: "You're almost up!",
    body: `You're next in line for ${queue.name}. Please be ready.`,
    data: { queueId: String(queue.id), entryId: front.id },
  });
  getRealtime().emitToUser(String(front.userId), QUEUE_EVENTS.UPDATED, {
    queueId: String(queue.id),
    entryId: front.id,
    position: peopleAhead + 1,
  });
}

/** Broadcast a generic "queue changed" signal to the queue room + business dashboard. */
function broadcastQueueChange(queue: QueueDoc): void {
  getRealtime().emitToQueue(String(queue.id), QUEUE_EVENTS.UPDATED, { queueId: String(queue.id) });
  getRealtime().emitToBusiness(String(queue.businessId), RT_EVENTS.DASHBOARD_UPDATED, {
    queueId: queue.id,
  });
}

export const entriesService = {
  // ---- Customer actions ----

  async join(userId: string, queueId: string) {
    const queue = await getQueueOrThrow(queueId);
    if (queue.status !== 'OPEN') throw new BadRequestError('This queue is not currently open');

    // Only ACTIVE businesses accept customers (DRAFT/SUSPENDED are not joinable).
    const business = await businessesRepository.findById(String(queue.businessId));
    if (!business || business.status !== 'ACTIVE') {
      throw new BadRequestError('This business is not currently accepting customers');
    }

    const existing = await entriesRepository.findActiveByUserAndQueue(userId, queueId);
    if (existing) throw new ConflictError('You are already in this queue');

    if (queue.maxCapacity) {
      const waiting = await entriesRepository.countWaiting(queueId);
      if (waiting >= queue.maxCapacity) throw new BadRequestError('This queue is full');
    }

    const ticketNumber = await queuesRepository.nextTicketNumber(queueId);
    let entry: QueueEntryDoc;
    try {
      entry = await entriesRepository.create({
        queueId,
        businessId: queue.businessId,
        userId,
        ticketNumber,
        status: 'WAITING',
        joinedAt: new Date(),
      });
    } catch (err) {
      // Unique partial index race -> someone double-tapped.
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictError('You are already in this queue');
      }
      throw err;
    }

    await logEvent('QUEUE_JOIN', { businessId: queue.businessId, queueId, userId });
    getRealtime().emitToQueue(queueId, QUEUE_EVENTS.JOINED, {
      queueId,
      ticketNumber: entry.ticketNumber,
    });
    broadcastQueueChange(queue);
    return withPosition(entry, queue);
  },

  async getMyActiveEntries(userId: string) {
    const entries = await entriesRepository.findActiveByUser(userId);
    const out = [];
    for (const entry of entries) {
      const queue = await queuesRepository.findById(String(entry.queueId));
      if (queue) out.push({ ...(await withPosition(entry, queue)), queueName: queue.name });
    }
    return out;
  },

  async leave(userId: string, entryId: string) {
    const entry = await entriesRepository.findById(entryId);
    if (!entry) throw new NotFoundError('Entry not found');
    if (String(entry.userId) !== userId) throw new ForbiddenError('Not your entry');
    if (!['WAITING', 'CALLED'].includes(entry.status)) {
      throw new BadRequestError('You can no longer leave this queue');
    }

    const updated = await entriesRepository.updateById(entryId, 'CANCELLED');
    await logEvent('QUEUE_LEAVE', {
      businessId: entry.businessId,
      queueId: entry.queueId,
      userId,
    });

    const queue = await queuesRepository.findById(String(entry.queueId));
    if (queue) {
      broadcastQueueChange(queue);
      await notifyNextInLine(queue);
    }
    return baseEntryView(updated!);
  },

  // ---- Staff / operator actions ----

  async listForOperator(userId: string, role: Role, queueId: string) {
    const queue = await getQueueOrThrow(queueId);
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);

    const entries = await entriesRepository.listActiveByQueue(queueId);
    let waitingSeen = 0;
    return entries.map((e) => {
      const isWaiting = e.status === 'WAITING';
      if (isWaiting) waitingSeen += 1;
      const populatedUser = e.userId as unknown as { name?: string; avatarUrl?: string };
      return {
        ...baseEntryView(e),
        position: isWaiting ? waitingSeen : e.status === 'CALLED' ? 0 : null,
        customer: { name: populatedUser?.name ?? 'Customer', avatarUrl: populatedUser?.avatarUrl },
      };
    });
  },

  async callNext(userId: string, role: Role, queueId: string) {
    const queue = await getQueueOrThrow(queueId);
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);

    const called = await entriesRepository.callOldestWaiting(queueId, new Date());
    if (!called) throw new BadRequestError('No customers are waiting');

    await logEvent('QUEUE_CALLED', {
      businessId: queue.businessId,
      queueId,
      userId: called.userId,
    });

    await notifications.notify(String(called.userId), {
      type: 'QUEUE_CALLED',
      title: "It's your turn!",
      body: `You're being called for ${queue.name}. Ticket #${called.ticketNumber}.`,
      data: { queueId, entryId: called.id },
    });
    const nextPayload = {
      queueId,
      entryId: called.id,
      ticketNumber: called.ticketNumber,
      calledUserId: String(called.userId),
    };
    // Broadcast to the room (operators + waiters) and personally to the called user.
    getRealtime().emitToQueue(queueId, QUEUE_EVENTS.NEXT, nextPayload);
    getRealtime().emitToUser(String(called.userId), QUEUE_EVENTS.NEXT, nextPayload);
    broadcastQueueChange(queue);
    await notifyNextInLine(queue);

    return baseEntryView(called);
  },

  async startServing(userId: string, role: Role, entryId: string) {
    const entry = await entriesRepository.findById(entryId);
    if (!entry) throw new NotFoundError('Entry not found');
    const queue = await getQueueOrThrow(String(entry.queueId));
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);
    if (entry.status !== 'CALLED') throw new BadRequestError('Entry must be CALLED before serving');

    const updated = await entriesRepository.updateById(entryId, 'SERVING', {
      servingAt: new Date(),
      servedByStaffId: userId,
    });
    await logEvent('QUEUE_SERVING', { businessId: queue.businessId, queueId: queue.id });
    broadcastQueueChange(queue);
    getRealtime().emitToUser(String(entry.userId), QUEUE_EVENTS.UPDATED, {
      queueId: String(queue.id),
      entryId,
      status: 'SERVING',
    });
    return baseEntryView(updated!);
  },

  async complete(userId: string, role: Role, entryId: string) {
    const entry = await entriesRepository.findById(entryId);
    if (!entry) throw new NotFoundError('Entry not found');
    const queue = await getQueueOrThrow(String(entry.queueId));
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);
    if (!['CALLED', 'SERVING'].includes(entry.status)) {
      throw new BadRequestError('Entry must be CALLED or SERVING to complete');
    }

    const now = new Date();
    const waitSec = Math.round((now.getTime() - entry.joinedAt.getTime()) / 1000);
    const serviceSec = entry.servingAt
      ? Math.round((now.getTime() - entry.servingAt.getTime()) / 1000)
      : undefined;

    const updated = await entriesRepository.updateById(entryId, 'COMPLETED', { completedAt: now });

    // Adapt the queue's average service time toward observed reality (EMA).
    if (serviceSec && serviceSec > 0) {
      const newAvg = Math.round(queue.avgServiceSec * 0.7 + serviceSec * 0.3);
      await queuesRepository.updateById(String(queue.id), { avgServiceSec: newAvg });
    }

    await logEvent('QUEUE_COMPLETED', {
      businessId: queue.businessId,
      queueId: queue.id,
      userId: entry.userId,
      durationSec: waitSec,
      payload: { serviceSec },
    });
    getRealtime().emitToQueue(String(queue.id), QUEUE_EVENTS.COMPLETED, {
      queueId: String(queue.id),
      entryId,
      ticketNumber: entry.ticketNumber,
    });
    getRealtime().emitToUser(String(entry.userId), QUEUE_EVENTS.COMPLETED, {
      queueId: String(queue.id),
      entryId,
    });
    broadcastQueueChange(queue);
    await notifyNextInLine(queue);
    return baseEntryView(updated!);
  },

  async noShow(userId: string, role: Role, entryId: string) {
    const entry = await entriesRepository.findById(entryId);
    if (!entry) throw new NotFoundError('Entry not found');
    const queue = await getQueueOrThrow(String(entry.queueId));
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);
    if (entry.status !== 'CALLED') throw new BadRequestError('Only a CALLED entry can be a no-show');

    const updated = await entriesRepository.updateById(entryId, 'NO_SHOW');
    await logEvent('QUEUE_NO_SHOW', {
      businessId: queue.businessId,
      queueId: queue.id,
      userId: entry.userId,
    });
    broadcastQueueChange(queue);
    await notifyNextInLine(queue);
    return baseEntryView(updated!);
  },
};
