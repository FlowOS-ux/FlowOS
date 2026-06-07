/**
 * FlowOS backend - tests/integration/auth.test.ts
 * Auth flow over the real app + in-memory Mongo: register -> login -> me -> refresh,
 * plus duplicate-register and bad-credential rejections.
 */
import { setupTestApp, teardownTestApp, clearDb, API, bearer, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(teardownTestApp);
afterEach(clearDb);

const customer = { name: 'Cara Customer', email: 'cara@flowos.test', password: 'password123' };

describe('auth flow', () => {
  it('registers a customer and returns tokens', async () => {
    const res = await ctx.agent.post(`${API}/auth/register`).send(customer);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects duplicate registration with 409', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);
    const dup = await ctx.agent.post(`${API}/auth/register`).send(customer);
    expect(dup.status).toBe(409);
  });

  it('logs in with valid credentials and rejects bad ones', async () => {
    await ctx.agent.post(`${API}/auth/register`).send(customer);

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

  it('returns the current user from /auth/me', async () => {
    const reg = await ctx.agent.post(`${API}/auth/register`).send(customer);
    const me = await ctx.agent.get(`${API}/auth/me`).set(bearer(reg.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(customer.email);
  });

  it('rejects /auth/me without a token', async () => {
    const res = await ctx.agent.get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('rotates tokens on refresh', async () => {
    const reg = await ctx.agent.post(`${API}/auth/register`).send(customer);
    const res = await ctx.agent
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: reg.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });
});
