/**
 * FlowOS - src/services/ai/heuristic.recommender.ts
 * Pure heuristic ranking helpers used for "recommendations" without an LLM.
 * (Shortest effective wait first.) Swap for an ML model later behind the same shape.
 */

export interface RankableQueue {
  queueId: string;
  businessId: string;
  peopleWaiting: number;
  avgServiceSec: number;
}

/** Lower score = recommended sooner. Score ~ estimated wait in seconds. */
export function scoreByWait(q: RankableQueue): number {
  return q.peopleWaiting * q.avgServiceSec;
}

export function rankQueuesByShortestWait<T extends RankableQueue>(queues: T[]): T[] {
  return [...queues].sort((a, b) => scoreByWait(a) - scoreByWait(b));
}
