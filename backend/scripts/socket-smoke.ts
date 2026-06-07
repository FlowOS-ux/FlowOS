/**
 * FlowOS - scripts/socket-smoke.ts
 * Real-time integration test. Boots the full HTTP + Socket.IO server against an
 * in-memory MongoDB, connects a customer socket, and verifies that operator
 * actions broadcast the expected queue events. Run: `npm run smoke:socket`.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'node:http';

const PORT = 4599;
// supertest runs against the app directly, so REST paths are relative.
// The Socket.IO client connects to the live server on PORT.
const API = '/api/v1';
let failures = 0;
function check(cond: boolean, msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${msg}`);
  if (!cond) failures += 1;
}

function waitForEvent<T>(
  socket: { once: (e: string, cb: (p: T) => void) => void },
  event: string,
  timeoutMs = 4000,
): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('flowos');
  process.env.JWT_SECRET = 'test_access_secret_0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789abcdef';
  process.env.NODE_ENV = 'test';

  const { connectDB, disconnectDB } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  const { createSocketServer } = await import('../src/socket.js');
  const { initRealtime } = await import('../src/container.js');
  const request = (await import('supertest')).default;
  const { io: ioClient } = await import('socket.io-client');

  await connectDB();
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  initRealtime(io);
  await new Promise<void>((r) => httpServer.listen(PORT, r));

  const agent = request(app);
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  // Seed: owner + customer + active business + queue.
  const owner = (
    await agent.post(`${API}/auth/register`).send({
      name: 'Owner',
      email: 'o@rt.test',
      password: 'password123',
      role: 'BUSINESS_OWNER',
    })
  ).body;
  const customer = (
    await agent
      .post(`${API}/auth/register`)
      .send({ name: 'Customer', email: 'c@rt.test', password: 'password123' })
  ).body;

  const bizRes = await agent.post(`${API}/businesses`).set(bearer(owner.accessToken)).send({
    name: 'RT Clinic',
    category: 'HOSPITAL',
  });
  if (bizRes.status !== 201) {
    // eslint-disable-next-line no-console
    console.error('business create failed', bizRes.status, JSON.stringify(bizRes.body));
  }
  const businessId = bizRes.body.business.id;
  await agent.patch(`${API}/businesses/${businessId}`).set(bearer(owner.accessToken)).send({ status: 'ACTIVE' });
  const queueId = (
    await agent
      .post(`${API}/businesses/${businessId}/queues`)
      .set(bearer(owner.accessToken))
      .send({ name: 'General' })
  ).body.queue.id;

  // Connect the customer socket and subscribe to the queue room.
  const customerSocket = ioClient(`http://127.0.0.1:${PORT}`, {
    auth: { token: customer.accessToken },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    customerSocket.on('connect', resolve);
    customerSocket.on('connect_error', reject);
  });
  check(true, 'customer socket connected (JWT handshake)');
  customerSocket.emit('subscribe:queue', queueId);
  await new Promise((r) => setTimeout(r, 200)); // let the join take effect

  // Customer joins -> expect a queue_joined broadcast on the room.
  const joinedP = waitForEvent<{ queueId: string }>(customerSocket, 'queue_joined');
  await agent.post(`${API}/queues/${queueId}/join`).set(bearer(customer.accessToken));
  const joined = await joinedP;
  check(joined?.queueId === queueId, 'received queue_joined broadcast');

  // Operator calls next -> expect queue_next targeting the customer.
  const nextP = waitForEvent<{ calledUserId: string }>(customerSocket, 'queue_next');
  await agent.post(`${API}/queues/${queueId}/call-next`).set(bearer(owner.accessToken));
  const next = await nextP;
  check(next?.calledUserId === customer.user.id, 'received queue_next for the called customer');

  // Pause the queue -> expect queue_paused.
  const pausedP = waitForEvent<{ status: string }>(customerSocket, 'queue_paused');
  await agent.patch(`${API}/queues/${queueId}`).set(bearer(owner.accessToken)).send({ status: 'PAUSED' });
  const paused = await pausedP;
  check(paused?.status === 'PAUSED', 'received queue_paused broadcast');

  // Reject unauthenticated socket connections.
  const badSocket = ioClient(`http://127.0.0.1:${PORT}`, { transports: ['websocket'] });
  const rejected = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 3000);
    badSocket.on('connect_error', () => {
      clearTimeout(t);
      resolve(true);
    });
    badSocket.on('connect', () => {
      clearTimeout(t);
      resolve(false);
    });
  });
  check(rejected, 'socket without token is rejected');
  badSocket.close();

  customerSocket.close();
  io.close();
  httpServer.close();
  await disconnectDB();
  await mongo.stop();

  // eslint-disable-next-line no-console
  console.log(`\n${failures === 0 ? 'ALL SOCKET CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Socket smoke crashed:', err);
  process.exit(1);
});
