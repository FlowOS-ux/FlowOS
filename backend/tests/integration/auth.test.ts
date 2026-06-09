/**
 * FlowOS backend - tests/integration/auth.test.ts
 * Auth flow over the real app + in-memory Mongo, with email verification:
 * register -> (blocked) login -> verify-email -> login -> me -> refresh,
 * plus duplicate-register, wrong-code, and bad-credential rejections.
 * The emailed OTP is captured by spying on the email service.
 */
import {
  setupTestApp,
  teardownTestApp,
  clearDb,
  API,
  bearer,
  type TestContext,
} from '../helpers/app';
import { email } from '../../src/container.js';

let ctx: TestContext;
let sendSpy: jest.SpyInstance;

beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(teardownTestApp);
beforeEach(() => {
  sendSpy = jest.spyOn(email, 'send').mockResolvedValue(undefined);
});
afterEach(async () => {
  sendSpy.mockRestore();
  await clearDb();
});

const customer = { name: 'Cara Customer', email: 'cara@flowos.test', password: 'password123' };

/** Pull the 6-digit code from the most recent email the service was asked to send. */
function lastOtp(): string {
  const calls = sendSpy.mock.calls;
  const text = (calls[calls.length - 1][0] as { text: string }).text;
  const match = /\b(\d{6})\b/.exec(text);
  if (!match) throw new Error('no OTP found in email text');
  return match[1];
}

describe('auth flow (email verification)', () => {
  it('registers a customer and requires verification (no tokens yet)', async () => {
    const res = await ctx.agent.post(`${API}/auth/register`).send(customer);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('VERIFICATION_REQUIRED');
    expect(res.body.accessToken).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate registration with 409', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const dup = await ctx.agent.post(`${API}/auth/register`).send(customer);
    expect(dup.status).toBe(409);
  });

  it('blocks login until the email is verified (403 EMAIL_NOT_VERIFIED)', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const res = await ctx.agent
      .post(`${API}/auth/login`)
      .send({ email: customer.email, password: customer.password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('verifies with the emailed code, returns tokens, and exposes /auth/me', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const otp = lastOtp();

    const verify = await ctx.agent
      .post(`${API}/auth/verify-email`)
      .send({ email: customer.email, otp });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();
    expect(verify.body.user.emailVerified).toBe(true);

    const me = await ctx.agent.get(`${API}/auth/me`).set(bearer(verify.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(customer.email);
  });

  it('rejects an incorrect verification code with 400', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const otp = lastOtp();
    const wrong = otp === '000000' ? '111111' : '000000';
    const res = await ctx.agent
      .post(`${API}/auth/verify-email`)
      .send({ email: customer.email, otp: wrong });
    expect(res.status).toBe(400);
  });

  it('logs in after verification and rejects bad credentials', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    await ctx.agent
      .post(`${API}/auth/verify-email`)
      .send({ email: customer.email, otp: lastOtp() });

    const ok = await ctx.agent
      .post(`${API}/auth/login`)
      .send({ email: customer.email, password: customer.password });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    const bad = await ctx.agent
      .post(`${API}/auth/login`)
      .send({ email: customer.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rotates tokens on refresh', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const verify = await ctx.agent
      .post(`${API}/auth/verify-email`)
      .send({ email: customer.email, otp: lastOtp() });

    const res = await ctx.agent
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: verify.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects /auth/me without a token', async () => {
    const res = await ctx.agent.get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });
});
