/**
 * FlowOS - src/services/ai/recommendation.ts
 * Pure, DB-free recommendation logic for the AI Assistant:
 *   - parseQuery():  light NL intent + category extraction from a user message
 *   - scoreCandidate() / rankRecommendations(): the weighted scoring system
 *
 * Kept free of Mongoose/IO so it is trivially unit-testable and reusable. The
 * module service (modules/ai/recommend.service.ts) feeds it candidates built from
 * the live database. Swap for an ML model later behind the same shapes.
 *
 * SCORING (weights per the product spec):
 *   rating 40% · review count 20% · queue wait 25% · availability/open 15%
 * Each component is normalised to [0,1]; the weighted sum is the score in [0,1].
 * Intent shifts the weights (e.g. "shortest queue" weights wait far higher) so the
 * ranking adapts to what the user actually asked for.
 */

export type RecIntent = 'best_rated' | 'shortest_wait' | 'available_now' | 'nearby' | 'general';

/** A business + its live queue stats, ready to be scored. */
export interface RecCandidate {
  businessId: string;
  name: string;
  category: string;
  address: string | null;
  logoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  /** Total WAITING customers across the business's OPEN queues. */
  queueSize: number;
  /** Representative wait (the shortest OPEN queue) in seconds; 0 if open with no wait. */
  estimatedWaitSec: number;
  /** True when the business has at least one OPEN queue (joinable right now). */
  isOpen: boolean;
  /** The OPEN queue with the shortest wait — used for "join directly". */
  topQueueId: string | null;
}

export interface ScoredRecommendation extends RecCandidate {
  score: number; // 0..1
  reasons: string[];
  estimatedWaitText: string;
}

interface Weights {
  rating: number;
  review: number;
  wait: number;
  availability: number;
}

// Normalisation constants (explainable, not magic): a business is considered to
// have "fully trusted" review volume at 50 reviews, and a wait is "as bad as it
// gets" for scoring at 60 minutes.
const REVIEW_SATURATION = 50;
const MAX_WAIT_SEC = 60 * 60;

const BASE_WEIGHTS: Weights = { rating: 0.4, review: 0.2, wait: 0.25, availability: 0.15 };

// Per-intent weight presets (each sums to 1.0).
const INTENT_WEIGHTS: Record<RecIntent, Weights> = {
  general: BASE_WEIGHTS,
  nearby: BASE_WEIGHTS, // proximity is applied via the geo query, not the score
  best_rated: { rating: 0.55, review: 0.25, wait: 0.1, availability: 0.1 },
  shortest_wait: { rating: 0.2, review: 0.1, wait: 0.5, availability: 0.2 },
  available_now: { rating: 0.3, review: 0.15, wait: 0.25, availability: 0.3 },
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// Keyword → canonical category (matches the seeded demo categories).
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(bank|atm|finance|financial|loan|deposit)\b/i, 'BANK'],
  [/\b(restaurant|food|eat|dining|dinner|lunch|cafe|coffee|meal)\b/i, 'RESTAURANT'],
  [/\b(salon|spa|hair|haircut|beauty|barber|wellness|massage)\b/i, 'SALON'],
  [/\b(hospital|clinic|doctor|medical|health|dentist|pharmacy)\b/i, 'HOSPITAL'],
  [/\b(jewell?ery|jewelry|gold|diamond|ornament)\b/i, 'JEWELLERY'],
];

/** Extract a category (if any) and the dominant intent from a free-text message. */
export function parseQuery(message: string): { category: string | null; intent: RecIntent } {
  const text = message.toLowerCase();

  let category: string | null = null;
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(text)) {
      category = cat;
      break;
    }
  }

  let intent: RecIntent = 'general';
  if (/\b(right now|available now|join now|open now|can i join|available|currently open)\b/.test(text)) {
    intent = 'available_now';
  } else if (/\b(short(est)?|quick(est)?|fast(est)?|least wait|less wait|no wait|smallest queue)\b/.test(text)) {
    intent = 'shortest_wait';
  } else if (
    /\b(best|top|highest|good (?:review|rating)s?|well[- ]?rated|reputable|recommended|popular|high(?:ly|est)? rated)\b/.test(text)
  ) {
    intent = 'best_rated';
  } else if (/\b(near|nearby|close|closest|around me|near me|distance)\b/.test(text)) {
    intent = 'nearby';
  }

  return { category, intent };
}

/** Human-friendly wait label for a card. */
export function formatWait(estimatedWaitSec: number, isOpen: boolean): string {
  if (!isOpen) return 'Closed';
  if (estimatedWaitSec <= 0) return 'No wait';
  const min = Math.round(estimatedWaitSec / 60);
  return min <= 1 ? '~1 min' : `~${min} min`;
}

/** Title-case a category key, e.g. "RESTAURANT" -> "Restaurant". */
export function categoryLabel(category: string): string {
  if (!category) return 'Service';
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

function buildReasons(c: RecCandidate): string[] {
  const reasons: string[] = [];

  if (c.ratingCount === 0) {
    reasons.push('New — no ratings yet');
  } else if (c.ratingAvg >= 4.5) {
    reasons.push(`Highly rated (${c.ratingAvg.toFixed(1)}★)`);
  } else if (c.ratingAvg >= 4.0) {
    reasons.push(`Well rated (${c.ratingAvg.toFixed(1)}★)`);
  }

  if (c.ratingCount >= 20) reasons.push(`Trusted by ${c.ratingCount} reviews`);

  if (c.isOpen) {
    if (c.queueSize === 0) reasons.push('No wait — walk right in');
    else if (c.estimatedWaitSec <= 600) reasons.push(`Short wait (${formatWait(c.estimatedWaitSec, true)})`);
    else reasons.push(`Open now (${formatWait(c.estimatedWaitSec, true)})`);
  } else {
    reasons.push('Currently closed');
  }

  return reasons.slice(0, 3);
}

/** Score a single candidate in [0,1] using the intent-adjusted weights. */
export function scoreCandidate(c: RecCandidate, intent: RecIntent = 'general'): number {
  const w = INTENT_WEIGHTS[intent] ?? BASE_WEIGHTS;
  const ratingScore = c.ratingCount > 0 ? clamp01(c.ratingAvg / 5) : 0;
  const reviewScore = clamp01(c.ratingCount / REVIEW_SATURATION);
  const waitScore = c.isOpen ? 1 - clamp01(c.estimatedWaitSec / MAX_WAIT_SEC) : 0;
  const availabilityScore = c.isOpen ? 1 : 0;

  return (
    w.rating * ratingScore +
    w.review * reviewScore +
    w.wait * waitScore +
    w.availability * availabilityScore
  );
}

/**
 * Score, attach reasons, and rank candidates for the given intent.
 * For "available_now" we prefer open businesses but fall back to all if none are
 * open (so the user still gets a helpful answer rather than nothing).
 */
export function rankRecommendations(
  candidates: RecCandidate[],
  intent: RecIntent,
  limit = 4,
): ScoredRecommendation[] {
  let pool = candidates;
  if (intent === 'available_now') {
    const open = candidates.filter((c) => c.isOpen);
    if (open.length > 0) pool = open;
  }

  const scored: ScoredRecommendation[] = pool.map((c) => ({
    ...c,
    score: scoreCandidate(c, intent),
    reasons: buildReasons(c),
    estimatedWaitText: formatWait(c.estimatedWaitSec, c.isOpen),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Intent-aware tiebreakers.
    if (intent === 'shortest_wait') return a.estimatedWaitSec - b.estimatedWaitSec;
    if (intent === 'best_rated') return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
    return b.ratingCount - a.ratingCount;
  });

  return scored.slice(0, limit);
}
