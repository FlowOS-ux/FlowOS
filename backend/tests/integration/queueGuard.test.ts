/**
 * FlowOS backend - tests/integration/queueGuard.test.ts
 * Phase 2A guard: a customer cannot join a queue whose business is not ACTIVE.
 * Mirrors the smoke assertion as a first-class regression test.
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

async function seedOwnerCustomerQueue() {
  const owner = await registerAndLogin(ctx.agent, {
    name: 'Olivia Owner',
    email: 'owner@flowos.test',
    password: 'password123',
    role: 'BUSINESS_OWNER',
  });
  const customer = await registerAndLogin(ctx.agent, {
    name: 'Cara Customer',
    email: 'cara@flowos.test',
    password: 'password123',
  });

  const biz = await ctx.agent
    .post(`${API}/businesses`)
    .set(bearer(owner.accessToken))
    .send({ name: 'Test Clinic', category: 'HOSPITAL' });
  const businessId = biz.body.business.id as string;

  const queue = await ctx.agent
    .post(`${API}/businesses/${businessId}/queues`)
    .set(bearer(owner.accessToken))
    .send({ name: 'General', avgServiceSec: 120 });
  const queueId = queue.body.queue.id as string;

  return {
    ownerToken: owner.accessToken,
    customerToken: customer.accessToken,
    businessId,
    queueId,
  };
}

describe('join guard (business must be ACTIVE)', () => {
  it('blocks joining a DRAFT business with 400', async () => {
    const { customerToken, queueId } = await seedOwnerCustomerQueue();
    const res = await ctx.agent.post(`${API}/queues/${queueId}/join`).set(bearer(customerToken));
    expect(res.status).toBe(400);
  });

  it('allows joining once the business is approved (ACTIVE)', async () => {
    const { ownerToken, customerToken, businessId, queueId } = await seedOwnerCustomerQueue();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;

    await ctx.agent.post(`${API}/businesses/${businessId}/submit`).set(bearer(ownerToken));
    const approve = await ctx.agent
      .post(`${API}/businesses/${businessId}/approve`)
      .set(bearer(adminToken));
    expect(approve.status).toBe(200);
    expect(approve.body.business.status).toBe('ACTIVE');

    const join = await ctx.agent.post(`${API}/queues/${queueId}/join`).set(bearer(customerToken));
    expect(join.status).toBe(201);
    expect(join.body.entry.status).toBe('WAITING');
    expect(join.body.entry.position).toBe(1);
  });
});
