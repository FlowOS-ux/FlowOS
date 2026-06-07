/**
 * FlowOS - src/modules/queues/queues.service.ts
 * Queue creation and management (a "queue" is a service line within a business).
 */
import { queuesRepository } from './queues.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { assertBusinessRole } from '../../lib/businessAccess';
import { getRealtime } from '../../container';
import { QUEUE_EVENTS, RT_EVENTS } from '../../services/realtime/realtime.interface';
import { NotFoundError } from '../../lib/errors';
import type { Role } from '../../types';
import type { QueueDoc } from '../../models';
import type { CreateQueueDto, UpdateQueueDto } from './queues.schema';

export function toPublicQueue(q: QueueDoc) {
  return {
    id: q.id as string,
    businessId: String(q.businessId),
    name: q.name,
    description: q.description ?? null,
    status: q.status,
    avgServiceSec: q.avgServiceSec,
    maxCapacity: q.maxCapacity ?? null,
    createdAt: q.createdAt,
  };
}

export const queuesService = {
  async create(userId: string, role: Role, businessId: string, dto: CreateQueueDto) {
    await assertBusinessRole(userId, businessId, 'MANAGER', role);
    const business = await businessesRepository.findById(businessId);
    if (!business) throw new NotFoundError('Business not found');

    const queue = await queuesRepository.create({ businessId, ...dto });
    return toPublicQueue(queue);
  },

  async listByBusiness(businessId: string) {
    const queues = await queuesRepository.listByBusiness(businessId);
    return queues.map(toPublicQueue);
  },

  async getById(id: string) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw new NotFoundError('Queue not found');
    return toPublicQueue(queue);
  },

  async update(userId: string, role: Role, id: string, dto: UpdateQueueDto) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw new NotFoundError('Queue not found');
    await assertBusinessRole(userId, String(queue.businessId), 'STAFF', role);

    const prevStatus = queue.status;
    const updated = await queuesRepository.updateById(id, dto);

    // Broadcast status transitions to the queue room + business dashboard.
    if (updated && dto.status && dto.status !== prevStatus) {
      const event =
        dto.status === 'PAUSED'
          ? QUEUE_EVENTS.PAUSED
          : dto.status === 'OPEN'
            ? QUEUE_EVENTS.RESUMED
            : QUEUE_EVENTS.UPDATED;
      getRealtime().emitToQueue(id, event, { queueId: id, status: dto.status });
      getRealtime().emitToBusiness(String(queue.businessId), RT_EVENTS.DASHBOARD_UPDATED, {
        queueId: id,
      });
    }
    return toPublicQueue(updated!);
  },
};
