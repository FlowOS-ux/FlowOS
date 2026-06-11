/**
 * FlowOS backend - tests/unit/recommendation.test.ts
 * Pure recommendation logic: intent/category parsing, weighted scoring, ranking,
 * tiebreakers, and edge cases (no ratings, closed, empty queue).
 */
import {
  parseQuery,
  scoreCandidate,
  rankRecommendations,
  formatWait,
  type RecCandidate,
} from '../../src/services/ai/recommendation.js';

function candidate(overrides: Partial<RecCandidate> = {}): RecCandidate {
  return {
    businessId: 'b1',
    name: 'Test',
    category: 'BANK',
    address: null,
    logoUrl: null,
    ratingAvg: 4.0,
    ratingCount: 10,
    queueSize: 2,
    estimatedWaitSec: 600,
    isOpen: true,
    topQueueId: 'q1',
    ...overrides,
  };
}

describe('parseQuery', () => {
  it('extracts category from keywords', () => {
    expect(parseQuery('I need a bank nearby').category).toBe('BANK');
    expect(parseQuery('best restaurant for dinner').category).toBe('RESTAURANT');
    expect(parseQuery('a salon with short wait').category).toBe('SALON');
    expect(parseQuery('hospital with good reviews').category).toBe('HOSPITAL');
    expect(parseQuery('buy some gold jewellery').category).toBe('JEWELLERY');
    expect(parseQuery('find me a library').category).toBeNull();
  });

  it('detects intent', () => {
    expect(parseQuery('what can I join right now?').intent).toBe('available_now');
    expect(parseQuery('salon with the shortest queue').intent).toBe('shortest_wait');
    expect(parseQuery('which restaurant has the best ratings').intent).toBe('best_rated');
    expect(parseQuery('hospital with good reviews').intent).toBe('best_rated');
    expect(parseQuery('a bank near me').intent).toBe('nearby');
    expect(parseQuery('show me a bank').intent).toBe('general');
  });
});

describe('scoreCandidate', () => {
  it('returns a score in [0,1]', () => {
    const s = scoreCandidate(candidate());
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('scores a closed business below an equivalent open one', () => {
    const open = scoreCandidate(candidate({ isOpen: true }));
    const closed = scoreCandidate(candidate({ isOpen: false, topQueueId: null }));
    expect(open).toBeGreaterThan(closed);
  });

  it('rewards shorter waits more under the shortest_wait intent', () => {
    const fast = scoreCandidate(candidate({ estimatedWaitSec: 60 }), 'shortest_wait');
    const slow = scoreCandidate(candidate({ estimatedWaitSec: 3000 }), 'shortest_wait');
    expect(fast).toBeGreaterThan(slow);
  });

  it('handles no ratings (treats rating signal as neutral, not negative)', () => {
    const s = scoreCandidate(candidate({ ratingAvg: 0, ratingCount: 0 }));
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('rankRecommendations', () => {
  it('ranks the highest-rated first for best_rated intent', () => {
    const recs = rankRecommendations(
      [
        candidate({ businessId: 'low', ratingAvg: 3.5, ratingCount: 5 }),
        candidate({ businessId: 'high', ratingAvg: 4.9, ratingCount: 40 }),
      ],
      'best_rated',
    );
    expect(recs[0].businessId).toBe('high');
  });

  it('ranks the shortest wait first for shortest_wait intent', () => {
    const recs = rankRecommendations(
      [
        candidate({ businessId: 'slow', estimatedWaitSec: 3600 }),
        candidate({ businessId: 'fast', estimatedWaitSec: 120 }),
      ],
      'shortest_wait',
    );
    expect(recs[0].businessId).toBe('fast');
  });

  it('prefers open businesses for available_now but falls back when none are open', () => {
    const open = rankRecommendations(
      [candidate({ businessId: 'closed', isOpen: false }), candidate({ businessId: 'open', isOpen: true })],
      'available_now',
    );
    expect(open[0].businessId).toBe('open');

    const fallback = rankRecommendations(
      [candidate({ businessId: 'c1', isOpen: false }), candidate({ businessId: 'c2', isOpen: false })],
      'available_now',
    );
    expect(fallback.length).toBe(2); // not filtered to empty
  });

  it('attaches reasons and a wait label', () => {
    const [r] = rankRecommendations([candidate({ ratingAvg: 4.8, ratingCount: 30, queueSize: 0, estimatedWaitSec: 0 })], 'general');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.estimatedWaitText).toBe('No wait');
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate({ businessId: `b${i}` }));
    expect(rankRecommendations(many, 'general', 3).length).toBe(3);
  });
});

describe('formatWait', () => {
  it('labels closed, no-wait, and minutes', () => {
    expect(formatWait(600, false)).toBe('Closed');
    expect(formatWait(0, true)).toBe('No wait');
    expect(formatWait(540, true)).toBe('~9 min');
  });
});
