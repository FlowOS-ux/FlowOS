/**
 * FlowOS backend - tests/unit/password.test.ts
 * bcrypt hashing helpers: hashes verify, wrong inputs fail, hashes are salted.
 */
import { hashPassword, comparePassword, hashToken, compareToken } from '../../src/lib/password.js';

describe('password lib', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
    expect(await comparePassword('password123', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('password123');
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('produces a different hash each call (salted)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });

  it('hashes and verifies opaque tokens', async () => {
    const raw = 'a-refresh-token-value';
    const hash = await hashToken(raw);
    expect(await compareToken(raw, hash)).toBe(true);
    expect(await compareToken('other', hash)).toBe(false);
  });
});
