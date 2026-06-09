/**
 * FlowOS backend - tests/integration/adminVerification.test.ts
 * Admin business-verification workflow:
 *   DRAFT -> (owner submit) -> PENDING_VERIFICATION -> (admin approve) -> ACTIVE
 *                                                   \-> (admin reject)  -> REJECTED -> resubmit
 * Plus RBAC: only PLATFORM_ADMIN can list pending / approve / reject.
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

async function createBusiness(ownerToken: string) {
  const res = await ctx.agent
    .post(`${API}/businesses`)
    .set(bearer(ownerToken))
    .send({ name: 'Glow Salon', category: 'SALON' });
  return res.body.business.id as string;
}

describe('admin verification — happy path', () => {
  it('submit -> appears in pending -> approve -> ACTIVE + joinable', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const customer = await registerAndLogin(ctx.agent, {
      name: 'Cara Customer',
      email: 'cara@flowos.test',
      password: 'password123',
    });
    const id = await createBusiness(ownerToken);

    const queue = await ctx.agent
      .post(`${API}/businesses/${id}/queues`)
      .set(bearer(ownerToken))
      .send({ name: 'General', avgServiceSec: 120 });
    const queueId = queue.body.queue.id as string;

    // Cannot join while DRAFT.
    const earlyJoin = await ctx.agent
      .post(`${API}/queues/${queueId}/join`)
      .set(bearer(customer.accessToken));
    expect(earlyJoin.status).toBe(400);

    // Owner submits -> PENDING_VERIFICATION.
    const submit = await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));
    expect(submit.status).toBe(200);
    expect(submit.body.business.status).toBe('PENDING_VERIFICATION');

    // Shows up in the admin pending queue.
    const pending = await ctx.agent.get(`${API}/businesses/pending`).set(bearer(adminToken));
    expect(pending.status).toBe(200);
    expect(pending.body.businesses.some((b: { id: string }) => b.id === id)).toBe(true);

    // Admin approves -> ACTIVE.
    const approve = await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(adminToken));
    expect(approve.status).toBe(200);
    expect(approve.body.business.status).toBe('ACTIVE');

    // No longer pending.
    const pendingAfter = await ctx.agent.get(`${API}/businesses/pending`).set(bearer(adminToken));
    expect(pendingAfter.body.businesses.some((b: { id: string }) => b.id === id)).toBe(false);

    // Customer can now join.
    const join = await ctx.agent
      .post(`${API}/queues/${queueId}/join`)
      .set(bearer(customer.accessToken));
    expect(join.status).toBe(201);
  });
});

describe('admin verification — reject & resubmit', () => {
  it('reject stores a reason, hides from Explore, and allows edit + resubmit', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const id = await createBusiness(ownerToken);

    await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));

    const reject = await ctx.agent
      .post(`${API}/businesses/${id}/reject`)
      .set(bearer(adminToken))
      .send({ reason: 'Address looks incomplete' });
    expect(reject.status).toBe(200);
    expect(reject.body.business.status).toBe('REJECTED');
    expect(reject.body.business.rejectionReason).toBe('Address looks incomplete');

    // Not discoverable while REJECTED.
    const explore = await ctx.agent.get(`${API}/businesses`);
    expect(explore.body.items.some((b: { id: string }) => b.id === id)).toBe(false);

    // Owner can still edit a REJECTED business.
    const edit = await ctx.agent
      .patch(`${API}/businesses/${id}`)
      .set(bearer(ownerToken))
      .send({ address: '42 Real Street' });
    expect(edit.status).toBe(200);

    // ...and resubmit -> back to PENDING (reason cleared).
    const resubmit = await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.business.status).toBe('PENDING_VERIFICATION');
    expect(resubmit.body.business.rejectionReason).toBeNull();
  });
});

describe('admin verification — RBAC & invalid transitions', () => {
  it('forbids non-admins from listing pending / approving / rejecting', async () => {
    const ownerToken = await registerOwner();
    const customer = await registerAndLogin(ctx.agent, {
      name: 'Cara Customer',
      email: 'cara@flowos.test',
      password: 'password123',
    });
    const id = await createBusiness(ownerToken);
    await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));

    expect((await ctx.agent.get(`${API}/businesses/pending`).set(bearer(ownerToken))).status).toBe(
      403,
    );
    expect(
      (await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(ownerToken))).status,
    ).toBe(403);
    expect(
      (await ctx.agent.post(`${API}/businesses/${id}/reject`).set(bearer(customer.accessToken)))
        .status,
    ).toBe(403);
  });

  it('rejects approving a business that is not pending (400)', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const id = await createBusiness(ownerToken);

    // Still DRAFT — not pending.
    const approve = await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(adminToken));
    expect(approve.status).toBe(400);
  });

  it('rejects submitting an already-ACTIVE business (400)', async () => {
    const ownerToken = await registerOwner();
    const adminToken = (await createAdminAndLogin(ctx.agent)).accessToken;
    const id = await createBusiness(ownerToken);
    await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));
    await ctx.agent.post(`${API}/businesses/${id}/approve`).set(bearer(adminToken));

    const resubmit = await ctx.agent.post(`${API}/businesses/${id}/submit`).set(bearer(ownerToken));
    expect(resubmit.status).toBe(400);
  });
});
