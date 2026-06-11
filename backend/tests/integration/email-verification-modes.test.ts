/**
 * FlowOS backend - tests/integration/email-verification-modes.test.ts
 * Verifies the devCode ("Demo Mode") gate end to end, in whichever email mode the
 * process is configured for. The invariant under test:
 *
 *   devCode present in API responses  <=>  NO email provider configured (emailConfigured === false)
 *
 * Run once with a provider configured (Scenario A) and once with every provider env
 * blanked (Scenario B) to exercise BOTH branches. The flow itself
 * (register -> emailed OTP -> verify -> login) must succeed in BOTH modes. The OTP is
 * always captured from the (spied) email so the test never relies on devCode to verify.
 */
import {
  setupTestApp,
  teardownTestApp,
  clearDb,
  API,
  type TestContext,
} from '../helpers/app';
import { email, emailConfigured, emailProvider } from '../../src/container.js';

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

const user = { name: 'Mode Tester', email: 'mode@flowos.test', password: 'password123' };

/** Pull the 6-digit code from the most recent email the service was asked to send. */
function lastOtp(): string {
  const calls = sendSpy.mock.calls;
  const text = (calls[calls.length - 1][0] as { text: string }).text;
  const m = /\b(\d{6})\b/.exec(text);
  if (!m) throw new Error('no OTP found in email text');
  return m[1];
}

describe(`email verification flow (emailConfigured=${emailConfigured})`, () => {
  it(`register: an email is always sent and devCode is ${emailConfigured ? 'ABSENT' : 'PRESENT'}`, async () => {
    const res = await ctx.agent.post(`${API}/auth/register`).send(user);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('VERIFICATION_REQUIRED');
    expect(res.body.accessToken).toBeUndefined(); // no session before verification
    expect(sendSpy).toHaveBeenCalledTimes(1); // OTP is always emailed

    if (emailConfigured) {
      // Scenario A: a real provider is configured — the code is email-only.
      expect(res.body.devCode).toBeUndefined();
    } else {
      // Scenario B: no transport — expose the code so testing works, and it must
      // equal the code that was "emailed".
      expect(res.body.devCode).toMatch(/^\d{6}$/);
      expect(res.body.devCode).toBe(lastOtp());
    }
  });

  it('GET /system/health reports the active email provider, consistent with the gate', async () => {
    const res = await ctx.agent.get(`${API}/system/health`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(emailProvider);
    expect(['gmail', 'brevo', 'resend', 'mailjet', 'smtp', 'console']).toContain(res.body.email);
    // The diagnostic and the devCode gate must agree: console transport <=> not configured.
    expect(res.body.email === 'console').toBe(!emailConfigured);
  });

  it('resend-otp follows the same gate', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(user);
    const res = await ctx.agent.post(`${API}/auth/resend-otp`).send({ email: user.email });
    expect(res.status).toBe(200);
    if (emailConfigured) expect(res.body.devCode).toBeUndefined();
    else expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  it('full flow: register -> emailed OTP -> verify -> login succeeds', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(user);
    const otp = lastOtp(); // captured from the email in BOTH modes

    const verify = await ctx.agent
      .post(`${API}/auth/verify-email`)
      .send({ email: user.email, otp });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();
    expect(verify.body.user.emailVerified).toBe(true);

    const login = await ctx.agent
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });
});
