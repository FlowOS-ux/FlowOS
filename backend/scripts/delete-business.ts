/**
 * FlowOS - scripts/delete-business.ts
 * Dev utility to hard-delete a business and its related records (no DELETE API yet).
 * Usage: tsx scripts/delete-business.ts "<business name>"
 */
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';
const name = process.argv[2];

async function main(): Promise<void> {
  if (!name) {
    // eslint-disable-next-line no-console
    console.error('Usage: tsx scripts/delete-business.ts "<business name>"');
    process.exit(1);
  }

  await mongoose.connect(URI);
  const db = mongoose.connection;

  const biz = await db.collection('businesses').findOne({ name });
  if (!biz) {
    // eslint-disable-next-line no-console
    console.log(`No business named "${name}".`);
    await mongoose.disconnect();
    return;
  }

  const oid = biz._id;
  const related = [
    'queues',
    'queueEntries',
    'staffMembers',
    'appointments',
    'reviews',
    'savedBusinesses',
    'analyticsEvents',
  ];

  const result: Record<string, number> = {
    businesses: (await db.collection('businesses').deleteOne({ _id: oid })).deletedCount,
  };
  for (const c of related) {
    result[c] = (await db.collection(c).deleteMany({ businessId: oid })).deletedCount;
  }

  const remaining = await db.collection('businesses').find({}).project({ name: 1 }).toArray();
  // eslint-disable-next-line no-console
  console.log(`Deleted "${name}":`, JSON.stringify(result));
  // eslint-disable-next-line no-console
  console.log(
    'Remaining businesses:',
    JSON.stringify(remaining.map((b: { name?: string }) => b.name)),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('delete-business failed:', err);
  process.exit(1);
});
