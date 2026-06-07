/**
 * FlowOS backend - tests/integration/businesses.test.ts
 * Business Setup + Activation: a DRAFT business is hidden from Explore and becomes
 * discoverable only after activation; PATCH persists the 7-day hours schedule.
 */
import { setupTestApp, teardownTestApp, clearDb, API, bearer, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(teardownTestApp);
afterEach(clearDb);

async function registerOwner() {
  const res = await ctx.agent.post(`${API}/auth/register`).send({
    name: 'Olivia Owner',
    email: 'owner@flowos.test',
    password: 'password123',
    role: 'BUSINESS_OWNER',
  });
  return res.body.accessToken as string;
}

describe('business activation & discoverability', () => {
  it('hides DRAFT businesses from Explore and reveals them after activation', async () => {
    const token = await registerOwner();

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

    // Activate.
    const activate = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(token))
      .send({ status: 'ACTIVE' });
    expect(activate.status).toBe(200);
    expect(activate.body.business.status).toBe('ACTIVE');

    // ACTIVE -> discoverable in Explore.
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

    const stranger = await ctx.agent.post(`${API}/auth/register`).send({
      name: 'Stan Stranger',
      email: 'stranger@flowos.test',
      password: 'password123',
      role: 'BUSINESS_OWNER',
    });

    const res = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(stranger.body.accessToken))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(403);
  });
});
