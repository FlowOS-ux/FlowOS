/**
 * FlowOS - scripts/set-business-images.ts
 * Sets a luxury, INDIAN, category-appropriate image (logoUrl) on every business.
 *  - Restaurants  -> high-quality Indian cuisine photos (Unsplash, verified)
 *  - Government    -> Indian civic landmark (Unsplash, verified)
 *  - Hospital/Bank/Salon/Education -> Indian-tagged photos (loremflickr `india,<cat>`)
 * Matches by exact name first, then by category. Idempotent — safe to re-run.
 * Usage: tsx scripts/set-business-images.ts
 */
import mongoose from 'mongoose';
import { Business } from '../src/models/index.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';

const P = '?w=800&h=400&fit=crop&q=80&auto=format';
const un = (id: string) => `https://images.unsplash.com/${id}${P}`; // verified Indian photos
const lf = (tags: string, lock: number) => `https://loremflickr.com/800/400/${tags}/all?lock=${lock}`;

const BY_NAME: Record<string, string> = {
  // Healthcare — Indian-tagged
  'City Health Clinic': lf('india,clinic', 51),
  'CityCare Hospital': lf('india,hospital', 52),
  'Sunrise Multispeciality Clinic': lf('india,hospital', 53),
  // Banking — Indian-tagged
  Bank: lf('india,bank', 54),
  'Unity Bank Service Center': lf('india,bank', 55),
  // Restaurants — Indian cuisine (Unsplash, verified)
  'The Copper Spoon': un('photo-1631452180519-c014fe946bc7'),
  'Spice Garden Restaurant': un('photo-1585937421612-70a008356fbe'),
  'Urban Bites Café': un('photo-1596797038530-2c107229654b'),
  // Salon & Spa — Indian-tagged
  'Glow & Go Salon': lf('india,salon', 56),
  'Style Studio Salon': lf('india,salon', 57),
  'Glamour Lounge': lf('india,spa', 58),
  // Government — Indian civic landmark (Unsplash, verified)
  'Citizen Service Center': un('photo-1587474260584-136574528ed5'),
  // Education — Indian-tagged
  'Student Service Center': lf('india,university', 59),
};

const BY_CATEGORY: Record<string, string> = {
  HOSPITAL: lf('india,hospital', 60),
  BANK: lf('india,bank', 61),
  RESTAURANT: un('photo-1567188040759-fb8a883dc6d8'),
  SALON: lf('india,salon', 62),
  GOVERNMENT: un('photo-1587474260584-136574528ed5'),
  EDUCATION: lf('india,university', 63),
};
const DEFAULT_IMAGE = lf('india,business', 64);

async function main(): Promise<void> {
  await mongoose.connect(URI);
  const businesses = await Business.find({}).select('name category').lean();
  let updated = 0;
  for (const b of businesses) {
    const name = b.name as string;
    const category = b.category as string;
    const image = BY_NAME[name] ?? BY_CATEGORY[category] ?? DEFAULT_IMAGE;
    await Business.updateOne({ _id: b._id }, { $set: { logoUrl: image } });
    updated += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`Updated images on ${updated} businesses.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('set-business-images failed:', err);
  process.exit(1);
});
