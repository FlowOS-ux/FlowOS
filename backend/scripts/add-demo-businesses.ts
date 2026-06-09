/**
 * FlowOS - scripts/add-demo-businesses.ts
 * Demo data utility: re-images "City Health Clinic" and adds a salon, restaurant,
 * and SBI bank (all ACTIVE, owned by the seed owner) with category images.
 * Usage: tsx scripts/add-demo-businesses.ts   (run `npm run seed` first)
 *
 * NOTE: logoUrl values are close-matching public images (the exact images shared in
 * chat can't be hosted from here). Swap any logoUrl to use a real image/logo.
 */
import mongoose from 'mongoose';
import { Business, StaffMember, User } from '../src/models/index.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';

const IMG = '?w=800&h=400&fit=crop&q=80&auto=format';
const IMAGES = {
  clinic: `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d${IMG}`,
  salon: `https://images.unsplash.com/photo-1560066984-138dadb4c035${IMG}`,
  restaurant: `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4${IMG}`,
  bank: `https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f${IMG}`,
};

// Clinic location (Hyderabad — Banjara Hills) + rating.
const CLINIC_ADDRESS = 'Banjara Hills, Hyderabad';
const CLINIC_COORDS: [number, number] = [78.4347, 17.4156]; // [lng, lat]
const CLINIC_RATING = 4.1;
const CLINIC_RATING_COUNT = 132;

const NEW_BUSINESSES = [
  {
    name: 'Glow & Go Salon',
    category: 'SALON',
    address: 'Jubilee Hills, Hyderabad',
    coordinates: [78.4738, 17.4239] as [number, number],
    logoUrl: IMAGES.salon,
    ratingAvg: 4.2,
    ratingCount: 87,
  },
  {
    name: 'The Copper Spoon',
    category: 'RESTAURANT',
    address: 'Gachibowli, Hyderabad',
    coordinates: [78.3489, 17.4401] as [number, number],
    logoUrl: IMAGES.restaurant,
    ratingAvg: 3.8,
    ratingCount: 64,
  },
  {
    name: 'Bank',
    category: 'BANK',
    address: 'Ameerpet, Hyderabad',
    coordinates: [78.4487, 17.4374] as [number, number],
    logoUrl: IMAGES.bank,
    ratingAvg: 4.1,
    ratingCount: 215,
  },
];

async function main(): Promise<void> {
  await mongoose.connect(URI);

  const owner = await User.findOne({ email: 'owner@flowos.test' });
  if (!owner) {
    // eslint-disable-next-line no-console
    console.error('Seed owner (owner@flowos.test) not found. Run `npm run seed` first.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const ownerId = owner._id;

  // 0) Migration: a previously-named "SBI Bank" becomes "Bank".
  await Business.updateOne({ name: 'SBI Bank' }, { $set: { name: 'Bank' } });

  // 1) Re-image + relocate the existing clinic (Hyderabad).
  const clinic = await Business.updateOne(
    { name: 'City Health Clinic' },
    {
      $set: {
        logoUrl: IMAGES.clinic,
        address: CLINIC_ADDRESS,
        location: { type: 'Point', coordinates: CLINIC_COORDS },
        ratingAvg: CLINIC_RATING,
        ratingCount: CLINIC_RATING_COUNT,
      },
    },
  );

  // 2) Add (or refresh) the new businesses.
  const log: string[] = [];
  for (const b of NEW_BUSINESSES) {
    const existing = await Business.findOne({ name: b.name });
    if (existing) {
      await Business.updateOne(
        { _id: existing._id },
        {
          $set: {
            logoUrl: b.logoUrl,
            status: 'ACTIVE',
            category: b.category,
            address: b.address,
            location: { type: 'Point', coordinates: b.coordinates },
            ratingAvg: b.ratingAvg,
            ratingCount: b.ratingCount,
          },
        },
      );
      log.push(`relocated ${b.name}`);
      continue;
    }
    const biz = await Business.create({
      name: b.name,
      category: b.category,
      ownerId,
      address: b.address,
      location: { type: 'Point', coordinates: b.coordinates },
      logoUrl: b.logoUrl,
      status: 'ACTIVE',
      ratingAvg: b.ratingAvg,
      ratingCount: b.ratingCount,
    });
    await StaffMember.create({ userId: ownerId, businessId: biz.id, role: 'OWNER', status: 'ACTIVE' });
    log.push(`added ${b.name}`);
  }

  // eslint-disable-next-line no-console
  console.log(`clinic image updated: ${clinic.modifiedCount}; ${log.join(', ')}`);
  const all = await Business.find({}).select('name category status logoUrl').lean();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(all, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('add-demo-businesses failed:', err);
  process.exit(1);
});
