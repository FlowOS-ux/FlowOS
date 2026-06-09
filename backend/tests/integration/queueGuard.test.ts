/**
 * FlowOS backend - tests/integration/queueGuard.test.ts
 * Business-approval gate on operations: a business that is not APPROVED cannot
 * create queues (403 "Business approval is pending."); once an admin approves it,
 * queue creation and customer joins work.
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

async function seedOwnerCustomerBusiness() {
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

  return {
    ownerToken: owner.accessToken,
    customerToken: customer.accessToken,
    businessId: biz.body.business.id as string,
  };
}

async function approveBusiness(businessId: string) {
  const admin = await createAdminAndLogin(ctx.agent);
  return ctx.agent
    .patch(`${API}/admin/businesses/${businessId}/approve`)
    .set(bearer(admin.accessToken));
}

describe('business-approval gate on operations', () => {
  it('blocks queue creation while the business is PENDING (403)', async () => {
    const { ownerToken, businessId } = await seedOwnerCustomerBusiness();
    const res = await ctx.agent
      .post(`${API}/businesses/${businessId}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Business approval is pending.');
  });

  it('allows queue creation + customer join once approved', async () => {
    const { ownerToken, customerToken, businessId } = await seedOwnerCustomerBusiness();

    const approve = await approveBusiness(businessId);
    expect(approve.status).toBe(200);
    expect(approve.body.business.status).toBe('APPROVED');

    const queue = await ctx.agent
      .post(`${API}/businesses/${businessId}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General', avgServiceSec: 120 });
    expect(queue.status).toBe(201);

    const join = await ctx.agent
      .post(`${API}/queues/${queue.body.queue.id}/join`)
      .set(bearer(customerToken));
    expect(join.status).toBe(201);
    expect(join.body.entry.status).toBe('WAITING');
    expect(join.body.entry.position).toBe(1);
  });
});
