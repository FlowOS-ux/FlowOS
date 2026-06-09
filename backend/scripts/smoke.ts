/**
 * FlowOS - scripts/smoke.ts
 * End-to-end smoke test against an in-memory MongoDB. Exercises the core loop:
 * register -> create business -> create queue -> join -> position -> call-next ->
 * serve -> complete. Run: `npm run smoke`.
 *
 * Env is set BEFORE importing app code (which reads env at import time), so we use
 * dynamic imports after the in-memory server is up.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const API = '/api/v1';
let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    // eslint-disable-next-line no-console
    console.log(`  PASS  ${msg}`);
  } else {
    failures += 1;
    // eslint-disable-next-line no-console
    console.error(`  FAIL  ${msg}`);
  }
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('flowos');
  process.env.JWT_SECRET = 'test_access_secret_0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789abcdef';
  process.env.NODE_ENV = 'test';

  const { connectDB, disconnectDB } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  const request = (await import('supertest')).default;

  await connectDB();
  const app = createApp();
  const agent = request(app);
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  // 1) Health
  const health = await agent.get(`${API}/system/health`);
  check(health.status === 200 && health.body.db === 'connected', 'health: db connected');

  // 2) Register owner + customer. Registration now requires email verification;
  //    in non-prod the OTP is returned as `devCode`, so we verify inline.
  const registerVerified = async (body: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) => {
    const reg = await agent.post(`${API}/auth/register`).send(body);
    const verified = await agent
      .post(`${API}/auth/verify-email`)
      .send({ email: body.email, otp: reg.body.devCode });
    return { reg, verified };
  };

  const owner = await registerVerified({
    name: 'Olivia Owner',
    email: 'owner@flowos.test',
    password: 'password123',
    role: 'BUSINESS_OWNER',
  });
  check(
    owner.reg.status === 201 && !!owner.verified.body.accessToken,
    'register + verify: business owner',
  );
  const ownerToken = owner.verified.body.accessToken as string;

  const customer = await registerVerified({
    name: 'Carl Customer',
    email: 'customer@flowos.test',
    password: 'password123',
  });
  check(customer.verified.body.user.role === 'CUSTOMER', 'register + verify: customer');
  const customerToken = customer.verified.body.accessToken as string;

  // Platform admin (register API can't self-assign admin) — elevate in the DB, then log in.
  const { User } = await import('../src/models/index.js');
  await agent
    .post(`${API}/auth/register`)
    .send({ name: 'Platform Admin', email: 'admin@flowos.test', password: 'password123' });
  await User.updateOne(
    { email: 'admin@flowos.test' },
    { $set: { emailVerified: true, role: 'PLATFORM_ADMIN' } },
  );
  const adminLogin = await agent
    .post(`${API}/auth/login`)
    .send({ email: 'admin@flowos.test', password: 'password123' });
  const adminToken = adminLogin.body.accessToken as string;
  check(!!adminToken, 'admin: created + logged in');

  // 3) Login round-trip + refresh
  const login = await agent.post(`${API}/auth/login`).send({ email: 'owner@flowos.test', password: 'password123' });
  check(login.status === 200 && !!login.body.refreshToken, 'login: returns tokens');
  const refreshed = await agent.post(`${API}/auth/refresh`).send({ refreshToken: login.body.refreshToken });
  check(refreshed.status === 200 && !!refreshed.body.accessToken, 'refresh: rotates token');

  // 4) Create business -> PENDING_VERIFICATION; admin approves -> APPROVED
  const biz = await agent
    .post(`${API}/businesses`)
    .set(bearer(ownerToken))
    .send({ name: 'City Clinic', category: 'HOSPITAL', address: '1 Main St', location: { lat: 12.9, lng: 77.6 } });
  check(
    biz.status === 201 && biz.body.business.status === 'PENDING_VERIFICATION',
    'business: created (PENDING_VERIFICATION)',
  );
  const businessId = biz.body.business.id as string;

  // Queue creation is blocked until the business is approved.
  const earlyQueue = await agent
    .post(`${API}/businesses/${businessId}/queues`)
    .set(bearer(ownerToken))
    .send({ name: 'Blocked', avgServiceSec: 60 });
  check(earlyQueue.status === 403, 'guard: queue creation blocked while pending (403)');

  // Admin sees it in the pending list, then approves it.
  const pendingList = await agent.get(`${API}/admin/businesses/pending`).set(bearer(adminToken));
  check(
    pendingList.status === 200 &&
      pendingList.body.businesses.some((b: { id: string }) => b.id === businessId),
    'admin: business appears in pending list',
  );
  const approve = await agent
    .patch(`${API}/admin/businesses/${businessId}/approve`)
    .set(bearer(adminToken));
  check(
    approve.status === 200 && approve.body.business.status === 'APPROVED',
    'admin: approved -> APPROVED',
  );

  // 5) Create queue
  const queue = await agent
    .post(`${API}/businesses/${businessId}/queues`)
    .set(bearer(ownerToken))
    .send({ name: 'General Consultation', avgServiceSec: 300 });
  check(queue.status === 201 && !!queue.body.queue.id, 'queue: created');
  const queueId = queue.body.queue.id as string;

  // 6) Customer joins
  const join = await agent.post(`${API}/queues/${queueId}/join`).set(bearer(customerToken));
  check(join.status === 201 && join.body.entry.status === 'WAITING', 'join: entry WAITING');
  check(join.body.entry.position === 1, 'join: position is 1');
  const entryId = join.body.entry.id as string;

  // 6b) Double-join is rejected
  const dup = await agent.post(`${API}/queues/${queueId}/join`).set(bearer(customerToken));
  check(dup.status === 409, 'join: duplicate rejected (409)');

  // 7) Customer sees their position
  const mine = await agent.get(`${API}/entries/me`).set(bearer(customerToken));
  check(mine.status === 200 && mine.body.entries.length === 1, 'me: one active entry');
  check(mine.body.entries[0].estimatedWaitSec === 0, 'me: ETA computed (0 ahead)');

  // 8) Operator sees the waiting list
  const opList = await agent.get(`${API}/queues/${queueId}/entries`).set(bearer(ownerToken));
  check(opList.status === 200 && opList.body.entries.length === 1, 'operator: sees 1 entry');

  // 9) Call next -> serve -> complete
  const call = await agent.post(`${API}/queues/${queueId}/call-next`).set(bearer(ownerToken));
  check(call.status === 200 && call.body.entry.status === 'CALLED', 'call-next: CALLED');

  const serve = await agent.post(`${API}/entries/${entryId}/serve`).set(bearer(ownerToken));
  check(serve.status === 200 && serve.body.entry.status === 'SERVING', 'serve: SERVING');

  const complete = await agent.post(`${API}/entries/${entryId}/complete`).set(bearer(ownerToken));
  check(complete.status === 200 && complete.body.entry.status === 'COMPLETED', 'complete: COMPLETED');

  // 10) Notification was created for the called customer
  const { Notification } = await import('../src/models/index.js');
  const notifCount = await Notification.countDocuments({ type: 'QUEUE_CALLED' });
  check(notifCount === 1, 'notification: QUEUE_CALLED persisted');

  // 11) RBAC: customer cannot call-next
  const forbidden = await agent.post(`${API}/queues/${queueId}/call-next`).set(bearer(customerToken));
  check(forbidden.status === 403, 'rbac: customer cannot call-next (403)');

  // 12) Operations guard: a brand-new PENDING business is blocked from queue creation.
  const pendingBiz = await agent
    .post(`${API}/businesses`)
    .set(bearer(ownerToken))
    .send({ name: 'Pending Clinic', category: 'HOSPITAL' });
  const blockedQueue = await agent
    .post(`${API}/businesses/${pendingBiz.body.business.id}/queues`)
    .set(bearer(ownerToken))
    .send({ name: 'General' });
  check(
    blockedQueue.status === 403,
    'guard: pending business cannot create queues (403 Business approval is pending.)',
  );

  // 13) Admin RBAC: a non-admin cannot use the verification API.
  const ownerPending = await agent.get(`${API}/admin/businesses/pending`).set(bearer(ownerToken));
  check(ownerPending.status === 403, 'rbac: non-admin cannot list pending (403)');
  const ownerApprove = await agent
    .patch(`${API}/admin/businesses/${businessId}/approve`)
    .set(bearer(ownerToken));
  check(ownerApprove.status === 403, 'rbac: non-admin cannot approve (403)');

  await disconnectDB();
  await mongo.stop();

  // eslint-disable-next-line no-console
  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
