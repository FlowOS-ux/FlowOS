/**
 * FlowOS - src/modules/ai/recommend.service.ts
 * AI Assistant recommendation orchestration. Turns a natural-language request into
 * a ranked list of joinable services:
 *   1. parse intent + category from the message,
 *   2. query APPROVED businesses (optionally by category / near a location),
 *   3. enrich each with LIVE queue stats (open queues, people waiting, ETA),
 *   4. score + rank via the pure recommendation service, and
 *   5. compose a natural-language reply (Groq when configured; deterministic else).
 *
 * The structured `recommendations` array is always DB-derived and authoritative —
 * the LLM only phrases the prose, so the actionable cards can never show
 * hallucinated businesses or numbers.
 */
import { businessesRepository } from '../businesses/businesses.repository';
import { queuesRepository } from '../queues/queues.repository';
import { entriesRepository } from '../entries/entries.repository';
import { assistant } from '../../container';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { APPROVED_STATUS } from '../../types';
import type { FilterQuery } from 'mongoose';
import type { BusinessDoc } from '../../models';
import {
  parseQuery,
  rankRecommendations,
  categoryLabel,
  type RecCandidate,
  type RecIntent,
  type ScoredRecommendation,
} from '../../services/ai/recommendation';
import type { RecommendDto } from './ai.schema';

const CANDIDATE_LIMIT = 30; // businesses considered before ranking
const DEFAULT_RESULTS = 4;

export interface RecommendResult {
  reply: string;
  query: { category: string | null; intent: RecIntent };
  recommendations: ScoredRecommendation[];
}

/** Build a scoreable candidate from a business + its live queue state. */
async function toCandidate(b: BusinessDoc): Promise<RecCandidate> {
  const queues = await queuesRepository.listByBusiness(b.id as string);
  const openQueues = queues.filter((q) => q.status === 'OPEN');

  const waits = await Promise.all(
    openQueues.map(async (q) => {
      const waiting = await entriesRepository.countWaiting(q.id as string);
      return { queueId: q.id as string, waiting, sec: waiting * (q.avgServiceSec ?? 300) };
    }),
  );

  const isOpen = waits.length > 0;
  const queueSize = waits.reduce((sum, w) => sum + w.waiting, 0);
  // "Representative" wait = the OPEN queue you could join with the shortest ETA.
  const shortest = waits.length
    ? waits.reduce((best, w) => (w.sec < best.sec ? w : best))
    : null;

  return {
    businessId: b.id as string,
    name: b.name,
    category: b.category,
    address: b.address ?? null,
    logoUrl: b.logoUrl ?? null,
    ratingAvg: b.ratingAvg ?? 0,
    ratingCount: b.ratingCount ?? 0,
    queueSize,
    estimatedWaitSec: shortest ? shortest.sec : 0,
    isOpen,
    topQueueId: shortest ? shortest.queueId : null,
  };
}

async function fetchBusinesses(
  category: string | null,
  near: { lat: number; lng: number } | undefined,
): Promise<BusinessDoc[]> {
  const filter: FilterQuery<BusinessDoc> = { status: APPROVED_STATUS };
  if (category) filter.category = category;
  const { items } = await businessesRepository.search({
    filter,
    skip: 0,
    limit: CANDIDATE_LIMIT,
    near: near ? { lng: near.lng, lat: near.lat, maxDistanceMeters: 50_000 } : undefined,
  });
  return items;
}

export const recommendService = {
  async recommend(dto: RecommendDto): Promise<RecommendResult> {
    const { category, intent } = parseQuery(dto.message);
    const near = dto.lat !== undefined && dto.lng !== undefined ? { lat: dto.lat, lng: dto.lng } : undefined;

    let items = await fetchBusinesses(category, near);

    // Edge case: a category was requested but nothing matched. Broaden to all
    // approved businesses so the user still gets help (the reply explains this).
    let broadened = false;
    if (category && items.length === 0) {
      items = await fetchBusinesses(null, near);
      broadened = true;
    }

    const candidates = await Promise.all(items.map(toCandidate));
    const recommendations = rankRecommendations(
      candidates,
      intent,
      dto.limit ?? DEFAULT_RESULTS,
    );

    const reply = await buildReply({
      message: dto.message,
      intent,
      category,
      broadened,
      recommendations,
      totalApproved: items.length,
    });

    return { reply, query: { category, intent }, recommendations };
  },
};

// ---- Natural-language reply ----------------------------------------------------

interface ReplyContext {
  message: string;
  intent: RecIntent;
  category: string | null;
  broadened: boolean;
  recommendations: ScoredRecommendation[];
  totalApproved: number;
}

async function buildReply(ctx: ReplyContext): Promise<string> {
  const deterministic = deterministicReply(ctx);
  // Use the LLM only to phrase the prose, grounded in the structured list, and
  // only when configured. Any failure falls back to the deterministic reply.
  if (!env.GROQ_API_KEY || ctx.recommendations.length === 0) return deterministic;

  try {
    const context = ctx.recommendations.map((r) => ({
      name: r.name,
      category: categoryLabel(r.category),
      rating: r.ratingAvg,
      reviews: r.ratingCount,
      queueSize: r.queueSize,
      wait: r.estimatedWaitText,
      open: r.isOpen,
      reasons: r.reasons,
    }));
    const system =
      'You are FlowOS Assistant, helping a customer pick a service to visit. ' +
      'Recommend ONLY from the JSON list provided — never invent businesses, ' +
      'ratings, or wait times. Reply in 2-3 friendly sentences, naming your top ' +
      'pick (and optionally a runner-up) and why. Do not output a list or markdown.';
    const user =
      `User asked: "${ctx.message}"\n` +
      `Ranked options (best first): ${JSON.stringify(context)}`;
    const reply = await assistant.chat([{ role: 'user', content: user }], system);
    const trimmed = (reply ?? '').trim();
    return trimmed.length > 0 ? trimmed : deterministic;
  } catch (err) {
    logger.error({ err }, 'AI recommend reply generation failed; using deterministic reply');
    return deterministic;
  }
}

function deterministicReply(ctx: ReplyContext): string {
  const { recommendations: recs, category, intent, broadened, totalApproved } = ctx;

  if (totalApproved === 0) {
    return "There aren't any approved services on FlowOS yet. Please check back soon.";
  }
  if (recs.length === 0) {
    return category
      ? `I couldn't find any ${categoryLabel(category).toLowerCase()} services right now.`
      : "I couldn't find a matching service right now.";
  }

  const top = recs[0];
  const label = categoryLabel(top.category);
  const reasonText = top.reasons.join(', ').toLowerCase();
  const prefix = broadened && category
    ? `I couldn't find any ${categoryLabel(category).toLowerCase()} services, but here are other great options. `
    : '';

  let lead: string;
  switch (intent) {
    case 'best_rated':
      lead =
        top.ratingCount > 0
          ? `For top-rated picks, ${top.name} leads with ${top.ratingAvg.toFixed(1)}★ from ${top.ratingCount} reviews.`
          : `${top.name} is my top pick.`;
      break;
    case 'shortest_wait':
      lead = top.isOpen
        ? `For the shortest wait, head to ${top.name} — ${top.estimatedWaitText.toLowerCase()} with ${top.queueSize} waiting.`
        : `Nothing has an open queue right now, but ${top.name} is the best option for when it reopens.`;
      break;
    case 'available_now':
      lead = top.isOpen
        ? `${top.name} is open and ready now (${top.estimatedWaitText.toLowerCase()}). You can join the queue right away.`
        : `Nothing has an open queue at the moment, but ${top.name} is the best ${label.toLowerCase()} for later.`;
      break;
    case 'nearby':
      lead = `The closest strong match is ${top.name} (${label}) — ${reasonText}.`;
      break;
    default:
      lead = `${top.name} (${label}) is my top pick — ${reasonText}.`;
  }

  const runnerUp =
    recs.length > 1 ? ` ${recs[1].name} is also worth a look.` : '';
  const tail =
    recs.length > 1 ? ` Here ${recs.length === 2 ? 'are 2 options' : `are ${recs.length} options`} ranked for you.` : '';

  return `${prefix}${lead}${runnerUp}${tail}`.trim();
}
