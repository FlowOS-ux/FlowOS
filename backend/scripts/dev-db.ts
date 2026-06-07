/**
 * FlowOS - scripts/dev-db.ts
 * Starts a local MongoDB at 127.0.0.1:27017 (db "flowos") using the mongodb-memory-server
 * binary — no MongoDB install needed. Handy for local dev / demos when MONGODB_URI points
 * at localhost. Data is in-memory (reset when this process stops), so run `npm run seed`
 * after it's up. Keep this process running alongside `npm run dev`.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: 'flowos' },
  });
  // eslint-disable-next-line no-console
  console.log('Local MongoDB ready at', mongo.getUri());

  const shutdown = async (): Promise<void> => {
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.resume(); // keep alive
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('dev-db failed:', err);
  process.exit(1);
});
