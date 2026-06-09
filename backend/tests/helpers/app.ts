/**
 * FlowOS backend - tests/helpers/app.ts
 * Spin up the real Express app against an in-memory MongoDB for integration tests.
 * jest.setup.ts has already set env, so importing app code here is safe.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest, { type SuperTest, type Test } from 'supertest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { createApp } from '../../src/app.js';

export const API = '/api/v1';

let mongo: MongoMemoryServer | null = null;

export interface TestContext {
  agent: SuperTest<Test>;
}

/** Start in-memory Mongo + the app; returns a supertest agent. */
export async function setupTestApp(): Promise<TestContext> {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri('flowos'));
  const app = createApp();
  return { agent: supertest(app) as unknown as SuperTest<Test> };
}

/** Tear down the app + in-memory Mongo. */
export async function teardownTestApp(): Promise<void> {
  await disconnectDB();
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

/**
 * Register a user, mark them verified (bypassing the emailed OTP), and log in.
 * Returns the AuthResult body (user + tokens). Use in tests that just need an
 * authenticated session; the OTP flow itself is covered in auth.test.ts.
 */
export async function registerAndLogin(
  agent: SuperTest<Test>,
  body: { name: string; email: string; password: string; role?: string },
): Promise<{ user: { id: string; role: string }; accessToken: string; refreshToken: string }> {
  await agent.post(`${API}/auth/register`).send(body);
  const db = mongoose.connection.db;
  if (db) {
    await db
      .collection('users')
      .updateOne({ email: body.email.toLowerCase() }, { $set: { emailVerified: true } });
  }
  const res = await agent
    .post(`${API}/auth/login`)
    .send({ email: body.email, password: body.password });
  return res.body;
}

/** Wipe all collections between tests for isolation. */
export async function clearDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
