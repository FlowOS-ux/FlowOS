/**
 * FlowOS backend - tests/unit/jwt.test.ts
 * Access/refresh tokens round-trip; cross-secret and tampered tokens are rejected.
 */
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/lib/jwt.js';

describe('jwt lib', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('signs and verifies an access token', () => {
    const token = signAccessToken(userId, 'CUSTOMER');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe('CUSTOMER');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(userId, 'BUSINESS_OWNER');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe('BUSINESS_OWNER');
  });

  it('does not verify an access token with the refresh secret', () => {
    const access = signAccessToken(userId, 'CUSTOMER');
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(userId, 'CUSTOMER');
    expect(() => verifyAccessToken(token + 'tampered')).toThrow();
  });
});
