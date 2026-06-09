/**
 * FlowOS - scripts/clear-businesses.ts
 * Removes ALL businesses and their dependent data (queues, queue entries, staff
 * memberships, reviews, saved-places, appointments, analytics events). User accounts,
 * auth, notifications, and support data are left intact. Reversible via the seed scripts.
 * Usage: tsx scripts/clear-businesses.ts
 */
import mongoose from 'mongoose';
import {
  Business,
  Queue,
  QueueEntry,
  StaffMember,
  Review,
  SavedBusiness,
  Appointment,
  AnalyticsEvent,
} from '../src/models/index.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';

async function main(): Promise<void> {
  await mongoose.connect(URI);
  const result: Record<string, number> = {
    businesses: (await Business.deleteMany({})).deletedCount,
    queues: (await Queue.deleteMany({})).deletedCount,
    queueEntries: (await QueueEntry.deleteMany({})).deletedCount,
    staffMembers: (await StaffMember.deleteMany({})).deletedCount,
    reviews: (await Review.deleteMany({})).deletedCount,
    savedBusinesses: (await SavedBusiness.deleteMany({})).deletedCount,
    appointments: (await Appointment.deleteMany({})).deletedCount,
    analyticsEvents: (await AnalyticsEvent.deleteMany({})).deletedCount,
  };
  // eslint-disable-next-line no-console
  console.log('Cleared:', JSON.stringify(result));
  // eslint-disable-next-line no-console
  console.log('Businesses remaining:', await Business.countDocuments());
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('clear-businesses failed:', err);
  process.exit(1);
});
