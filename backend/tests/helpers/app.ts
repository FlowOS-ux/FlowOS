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

/** Wipe all collections between tests for isolation. */
export async function clearDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
