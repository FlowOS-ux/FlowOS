/**
 * FlowOS backend - tests/integration/businesses.test.ts
 * Business Setup + Activation: a DRAFT business is hidden from Explore and becomes
 * discoverable only after activation; PATCH persists the 7-day hours schedule.
 */
import {
  setupTestApp,
  teardownTestApp,
  clearDb,
  registerAndLogin,
  createAdminAndLogin,
  API,
  bearer,
  type TestContext,
} from '../helpers/app';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(teardownTestApp);
afterEach(clearDb);

async function registerOwner() {
  const res = await registerAndLogin(ctx.agent, {
    name: 'Olivia Owner',
    email: 'owner@flowos.test',
    password: 'password123',
    role: 'BUSINESS_OWNER',
  });
  return res.accessToken;
}

describe('business verification & discoverability', () => {
  it('keeps DRAFT/PENDING hidden and reveals only after admin approval', async () => {
    const token = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;

    const created = await ctx.agent
      .post(`${API}/businesses`)
      .set(bearer(token))
      .send({ name: 'Glow Salon', category: 'SALON' });
    expect(created.status).toBe(201);
    expect(created.body.business.status).toBe('DRAFT');
    const id = created.body.business.id as string;

    // DRAFT -> not discoverable in Explore.
    const draftExplore = await ctx.agent.get(`${API}/businesses`);
    expect(draftExplore.status).toBe(200);
    expect(draftExplore.body.items.some((b: { id: string }) => b.id === id)).toBe(false);

    // Owner cannot self-activate (status is not owner-editable).
    const selfActivate = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(token))
      .send({ status: 'ACTIVE' });
    expect(selfActivate.status).toBe(422);

    // Owner submits for review -> PENDING_VERIFICATION (still hidden).
    const submit = await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(token));
    expect(submit.status).toBe(200);
    expect(submit.body.business.status).toBe('PENDING_VERIFICATION');
    const pendingExplore = await ctx.agent.get(`${API}/businesses`);
    expect(pendingExplore.body.items.some((b: { id: string }) => b.id === id)).toBe(false);

    // Admin approves -> ACTIVE -> discoverable.
    const approve = await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(adminToken));
    expect(approve.status).toBe(200);
    expect(approve.body.business.status).toBe('ACTIVE');

    const activeExplore = await ctx.agent.get(`${API}/businesses`);
    expect(activeExplore.body.items.some((b: { id: string }) => b.id === id)).toBe(true);
  });

  it('persists a 7-day opening-hours schedule via PATCH', async () => {
    const token = await registerOwner();
    const created = await ctx.agent
      .post(`${API}/businesses`)
      .set(bearer(token))
      .send({ name: 'Glow Salon', category: 'SALON' });
    const id = created.body.business.id as string;

    const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: dayOfWeek === 0,
    }));

    const res = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(token))
      .send({ hours });

    expect(res.status).toBe(200);
    expect(res.body.business.hours).toHaveLength(7);
    expect(res.body.business.hours[0].isClosed).toBe(true);
    expect(res.body.business.hours[1].openTime).toBe('09:00');
  });

  it('blocks a non-owner from updating the business', async () => {
    const ownerToken = await registerOwner();
    const created = await ctx.agent
      .post(`${API}/businesses`)
      .set(bearer(ownerToken))
      .send({ name: 'Glow Salon', category: 'SALON' });
    const id = created.body.business.id as string;

    const stranger = await registerAndLogin(ctx.agent, {
      name: 'Stan Stranger',
      email: 'stranger@flowos.test',
      password: 'password123',
      role: 'BUSINESS_OWNER',
    });

    const res = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(stranger.accessToken))
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(403);
  });
});

describe('delete business', () => {
  it('lets the owner delete their business and removes it from Explore + /mine', async () => {
    const token = await registerOwner();
    const created = await ctx.agent
      .post(`${API}/businesses`)
      .set(bearer(token))
      .send({ name: 'Temp Biz', category: 'OTHER' });
    const id = created.body.business.id as string;
    // Activate via the real flow: owner submits, admin approves.
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(token));
    await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(adminToken));
    // A queue exists so the cascade is exercised.
    await ctx.agent
      .post(`${API}/businesses/${id}/queues`)
      .set(bearer(token))
      .send({ name: 'General', avgServiceSec: 120 });

    const del = await ctx.agent.delete(`${API}/businesses/${id}`).set(bearer(token));
    expect(del.status).toBe(200);

    const mine = await ctx.agent.get(`${API}/businesses/mine`).set(bearer(token));
    expect(mine.body.businesses.some((b: { id: string }) => b.id === id)).toBe(false);

    const explore = await ctx.agent.get(`${API}/businesses`);
    expect(explore.body.items.some((b: { id: string }) => b.id === id)).toBe(false);

    // Cascade: the queue is gone too.
    const queues = await ctx.agent.get(`${API}/businesses/${id}/queues`);
    expect(queues.body.queues ?? []).toHaveLength(0);
  });

  it('blocks a non-owner from deleting', async () => {
    const ownerToken = await registerOwner();
    const created = await ctx.agent
      .post(`${API}/businesses`)
      .set(bearer(ownerToken))
      .send({ name: 'Temp Biz', category: 'OTHER' });
    const id = created.body.business.id as string;

    const stranger = await registerAndLogin(ctx.agent, {
      name: 'Stan Stranger',
      email: 'stan2@flowos.test',
      password: 'password123',
      role: 'BUSINESS_OWNER',
    });
    const res = await ctx.agent
      .delete(`${API}/businesses/${id}`)
      .set(bearer(stranger.accessToken));
    expect(res.status).toBe(403);
  });
});
