/**
 * FlowOS backend - tests/integration/adminVerification.test.ts
 * Admin business-verification workflow:
 *   create -> PENDING_VERIFICATION -> (admin PATCH approve) -> APPROVED (live)
 *                                  \-> (admin PATCH reject)  -> REJECTED (blocked)
 * Plus: pending businesses are blocked from operations (403), only an admin may
 * list/approve/reject, and approve/reject persist an audit trail.
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

async function registerOwner(email = 'owner@flowos.test') {
  const res = await registerAndLogin(ctx.agent, {
    name: 'Olivia Owner',
    email,
    password: 'password123',
    role: 'BUSINESS_OWNER',
  });
  return res.accessToken;
}

async function createBusiness(ownerToken: string) {
  const res = await ctx.agent
    .post(`${API}/businesses`)
    .set(bearer(ownerToken))
    .send({ name: 'Glow Salon', category: 'SALON', phone: '+1222', address: '5 Main St' });
  return res.body.business as { id: string; status: string };
}

describe('admin verification — happy path', () => {
  it('create -> pending -> approve -> APPROVED, then operations + join work', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const customer = await registerAndLogin(ctx.agent, {
      name: 'Cara Customer',
      email: 'cara@flowos.test',
      password: 'password123',
    });

    const business = await createBusiness(ownerToken);
    expect(business.status).toBe('PENDING_VERIFICATION');
    const id = business.id;

    // Pending business is blocked from operations (queue creation -> 403).
    const earlyQueue = await ctx.agent
      .post(`${API}/businesses/${id}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General' });
    expect(earlyQueue.status).toBe(403);
    expect(earlyQueue.body.error.message).toBe('Business approval is pending.');

    // Appears in the admin pending list with owner details.
    const pending = await ctx.agent.get(`${API}/admin/businesses/pending`).set(bearer(adminToken));
    expect(pending.status).toBe(200);
    const listed = pending.body.businesses.find((b: { id: string }) => b.id === id);
    expect(listed).toBeTruthy();
    expect(listed.owner.email).toBe('owner@flowos.test');

    // Admin approves -> APPROVED with an audit trail.
    const approve = await ctx.agent
      .patch(`${API}/admin/businesses/${id}/approve`)
      .set(bearer(adminToken));
    expect(approve.status).toBe(200);
    expect(approve.body.business.status).toBe('APPROVED');
    expect(approve.body.business.approvedAt).toBeTruthy();

    // Now in the approved list (and not pending).
    const approved = await ctx.agent.get(`${API}/admin/businesses/approved`).set(bearer(adminToken));
    expect(approved.body.businesses.some((b: { id: string }) => b.id === id)).toBe(true);

    // Owner can now create a queue, and a customer can join it.
    const queue = await ctx.agent
      .post(`${API}/businesses/${id}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General', avgServiceSec: 120 });
    expect(queue.status).toBe(201);
    const join = await ctx.agent
      .post(`${API}/queues/${queue.body.queue.id}/join`)
      .set(bearer(customer.accessToken));
    expect(join.status).toBe(201);
  });
});

describe('admin verification — rejection', () => {
  it('reject stores a reason, lists under rejected, and keeps the business blocked', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const { id } = await createBusiness(ownerToken);

    const reject = await ctx.agent
      .patch(`${API}/admin/businesses/${id}/reject`)
      .set(bearer(adminToken))
      .send({ reason: 'Address looks incomplete' });
    expect(reject.status).toBe(200);
    expect(reject.body.business.status).toBe('REJECTED');
    expect(reject.body.business.rejectionReason).toBe('Address looks incomplete');
    expect(reject.body.business.rejectedAt).toBeTruthy();

    // Listed under rejected, hidden from Explore, blocked from queue creation.
    const rejected = await ctx.agent.get(`${API}/admin/businesses/rejected`).set(bearer(adminToken));
    expect(rejected.body.businesses.some((b: { id: string }) => b.id === id)).toBe(true);

    const explore = await ctx.agent.get(`${API}/businesses`);
    expect(explore.body.items.some((b: { id: string }) => b.id === id)).toBe(false);

    const queue = await ctx.agent
      .post(`${API}/businesses/${id}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General' });
    expect(queue.status).toBe(403);
  });
});

describe('admin verification — RBAC & invalid transitions', () => {
  it('forbids non-admins from listing / approving / rejecting (403)', async () => {
    const ownerToken = await registerOwner();
    const customer = await registerAndLogin(ctx.agent, {
      name: 'Cara Customer',
      email: 'cara@flowos.test',
      password: 'password123',
    });
    const { id } = await createBusiness(ownerToken);

    expect(
      (await ctx.agent.get(`${API}/admin/businesses/pending`).set(bearer(ownerToken))).status,
    ).toBe(403);
    expect(
      (await ctx.agent.patch(`${API}/admin/businesses/${id}/approve`).set(bearer(ownerToken)))
        .status,
    ).toBe(403);
    expect(
      (
        await ctx.agent
          .patch(`${API}/admin/businesses/${id}/reject`)
          .set(bearer(customer.accessToken))
      ).status,
    ).toBe(403);
  });

  it('requires authentication for admin routes (401)', async () => {
    expect((await ctx.agent.get(`${API}/admin/businesses/pending`)).status).toBe(401);
  });

  it('rejects approving a business that is not pending (400)', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const { id } = await createBusiness(ownerToken);
    await ctx.agent.patch(`${API}/admin/businesses/${id}/approve`).set(bearer(adminToken));

    // Second approve -> already APPROVED -> 400.
    const again = await ctx.agent
      .patch(`${API}/admin/businesses/${id}/approve`)
      .set(bearer(adminToken));
    expect(again.status).toBe(400);
  });
});
