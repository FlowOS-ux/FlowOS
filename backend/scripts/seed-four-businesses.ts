/**
 * FlowOS - scripts/seed-four-businesses.ts
 * Seeds the core premium demo businesses — one each for RESTAURANT, SALON,
 * HOSPITAL, EDUCATION, and BANK — each with 4 category-related services (queues)
 * and a curated luxury thumbnail image (no people in any image). Idempotent: skips
 * any business whose name already exists, and ensures the demo owner account exists.
 *
 * Run: tsx scripts/seed-four-businesses.ts
 */
import { connectDB, disconnectDB } from '../src/config/db';
import { User, Business, StaffMember, Queue } from '../src/models';
import { hashPassword } from '../src/lib/password';
import { logger } from '../src/lib/logger';

/** Curated Unsplash images — all verified luxury interiors/architecture, no people. */
const img = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=400&fit=crop&q=80&auto=format`;

type Hour = { dayOfWeek: number; openTime?: string; closeTime?: string; isClosed: boolean };
const hours = (open: string, close: string, closedDays: number[]): Hour[] =>
  Array.from({ length: 7 }, (_, d) =>
    closedDays.includes(d)
      ? { dayOfWeek: d, isClosed: true }
      : { dayOfWeek: d, openTime: open, closeTime: close, isClosed: false },
  );

interface QueueDef {
  name: string;
  desc: string;
  avg: number;
  cap: number;
}
interface BizDef {
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  coords: [number, number]; // [lng, lat]
  ratingAvg: number;
  ratingCount: number;
  image: string;
  hours: Hour[];
  queues: QueueDef[];
}

const BUSINESSES: BizDef[] = [
  {
    name: 'Saffron Grand Fine Dining',
    category: 'RESTAURANT',
    description:
      'Award-winning fine-dining restaurant with curated tasting menus, an elegant bar lounge, and private dining suites.',
    address: 'Jubilee Hills, Hyderabad',
    phone: '+91 40 4001 7777',
    coords: [78.4738, 17.4239],
    ratingAvg: 4.7,
    ratingCount: 528,
    image: img('photo-1517248135467-4c7edcad34c4'),
    hours: hours('12:00', '23:30', []),
    queues: [
      { name: 'Walk-in Dining', desc: 'Join the waitlist for the next available table.', avg: 600, cap: 40 },
      { name: 'Table Reservation', desc: 'Check in for your booked table.', avg: 300, cap: 25 },
      { name: 'Private Dining', desc: 'Exclusive private dining suites for special occasions.', avg: 1200, cap: 8 },
      { name: 'Bar & Lounge', desc: 'Seating at the signature cocktail bar and lounge.', avg: 480, cap: 20 },
    ],
  },
  {
    name: 'Velvet Luxe Salon & Spa',
    category: 'SALON',
    description:
      'Luxury salon and spa delivering premium hair, skincare, nail, and wellness rituals in a serene designer space.',
    address: 'Road No. 36, Jubilee Hills, Hyderabad',
    phone: '+91 40 4567 9001',
    coords: [78.41, 17.43],
    ratingAvg: 4.6,
    ratingCount: 364,
    image: img('photo-1633681926022-84c23e8cb2d6'),
    hours: hours('10:00', '20:00', [1]),
    queues: [
      { name: 'Hair & Styling', desc: 'Precision cuts, colour, and styling by senior stylists.', avg: 1800, cap: 12 },
      { name: 'Beauty & Skincare', desc: 'Facials, advanced skincare, and grooming.', avg: 2400, cap: 10 },
      { name: 'Spa & Massage', desc: 'Relaxing massage and signature wellness therapies.', avg: 3600, cap: 6 },
      { name: 'Nails & Grooming', desc: 'Manicure, pedicure, and detailing.', avg: 1500, cap: 10 },
    ],
  },
  {
    name: 'Yashoda Hospitals',
    category: 'HOSPITAL',
    description:
      'Premium multispeciality hospital offering advanced diagnostics, specialist care, and an in-house pharmacy.',
    address: 'Somajiguda, Hyderabad',
    phone: '+91 40 2334 5000',
    coords: [78.4561, 17.4239],
    ratingAvg: 4.5,
    ratingCount: 912,
    // Real Hyderabad hospital: Yashoda Hospitals, Somajiguda — Wikimedia Commons.
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Yashoda_Hospitals_Somajiguda.jpg/960px-Yashoda_Hospitals_Somajiguda.jpg',
    hours: hours('08:00', '21:00', []),
    queues: [
      { name: 'General Consultation', desc: 'See a general physician.', avg: 300, cap: 40 },
      { name: 'Specialist Consultation', desc: 'Consult a specialist doctor.', avg: 600, cap: 20 },
      { name: 'Diagnostics & Lab', desc: 'Sample collection and diagnostic tests.', avg: 240, cap: 35 },
      { name: 'Pharmacy Pickup', desc: 'Collect prescribed medicines.', avg: 180, cap: 30 },
    ],
  },
  {
    name: 'Elite Learning Center',
    category: 'EDUCATION',
    description:
      'Premier learning center with expert faculty, a grand reference library, and dedicated admissions and student support.',
    address: 'Tarnaka, Hyderabad',
    phone: '+91 40 2700 4567',
    coords: [78.5253, 17.4256],
    ratingAvg: 4.4,
    ratingCount: 187,
    image: img('photo-1568667256549-094345857637'),
    hours: hours('09:00', '19:00', [0]),
    queues: [
      { name: 'Admissions Help Desk', desc: 'Course and admission guidance.', avg: 420, cap: 40 },
      { name: 'Course Counselling', desc: 'One-on-one academic and career counselling.', avg: 600, cap: 20 },
      { name: 'Student Services', desc: 'ID cards, letters, and general student help.', avg: 300, cap: 30 },
      { name: 'Fee & Records Support', desc: 'Fee payment and academic records.', avg: 240, cap: 50 },
    ],
  },
  {
    name: 'CTC BANK',
    category: 'BANK',
    description:
      'Premier bank offering priority account services, wealth advisory, lending, and a dedicated locker desk.',
    address: 'Road No. 1, Banjara Hills, Hyderabad',
    phone: '+91 40 4455 1100',
    coords: [78.4347, 17.4156],
    ratingAvg: 4.5,
    ratingCount: 296,
    // Real Hyderabad bank: State Bank of Hyderabad, Gunfoundry — Wikimedia Commons.
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/SBH_main_building_at_Gunfoundry_full.JPG/960px-SBH_main_building_at_Gunfoundry_full.JPG',
    hours: hours('10:00', '17:00', [0]),
    queues: [
      { name: 'Account Services', desc: 'Open or update accounts, cards, and KYC.', avg: 300, cap: 30 },
      { name: 'Cash Deposit & Withdrawal', desc: 'Teller counter for cash transactions.', avg: 180, cap: 40 },
      { name: 'Loan Consultation', desc: 'Personal, home, and business loan advisory.', avg: 900, cap: 12 },
      { name: 'Priority & Wealth Desk', desc: 'Dedicated desk for premium customers and lockers.', avg: 600, cap: 15 },
    ],
  },
  {
    name: 'City Hospitals',
    category: 'HOSPITAL',
    description:
      'Neighbourhood multispeciality clinic for consultations, diagnostics, and pharmacy needs.',
    address: 'Financial District, Nanakramguda, Hyderabad',
    phone: '+91 40 2998 4321',
    coords: [78.3421, 17.4159],
    ratingAvg: 4.3,
    ratingCount: 168,
    // Real Hyderabad medical facility: Continental Hospital, Nanakramguda — Wikimedia Commons.
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Continental_Hospital_Nanakramguda_FD_Hyd.jpg/960px-Continental_Hospital_Nanakramguda_FD_Hyd.jpg',
    hours: hours('09:00', '21:00', []),
    queues: [
      { name: 'General Consultation', desc: 'See a general physician.', avg: 300, cap: 40 },
      { name: 'Diagnostics & Lab', desc: 'Sample collection and diagnostic tests.', avg: 240, cap: 35 },
      { name: 'Pharmacy Pickup', desc: 'Collect prescribed medicines.', avg: 180, cap: 30 },
    ],
  },
  {
    name: 'Reserve Bank of India',
    category: 'BANK',
    description:
      "India's central bank — Hyderabad office. Public services for currency exchange, grievances, and verification.",
    address: 'Secretariat Road, Saifabad, Hyderabad',
    phone: '+91 40 2324 0000',
    coords: [78.4691, 17.4045],
    ratingAvg: 4.4,
    ratingCount: 124,
    // Real Hyderabad bank: Reserve Bank of India, Hyderabad branch — Wikimedia Commons.
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Reserve_Bank_of_India%2C_branch_at_Hyderabad.jpg/960px-Reserve_Bank_of_India%2C_branch_at_Hyderabad.jpg',
    hours: hours('10:00', '17:00', [0]),
    queues: [
      { name: 'General Enquiry', desc: 'Public reception and general assistance.', avg: 300, cap: 40 },
      { name: 'Currency & Coin Exchange', desc: 'Exchange of notes and coins.', avg: 240, cap: 30 },
      { name: 'KYC & Document Verification', desc: 'Verify and attest documents.', avg: 360, cap: 25 },
      { name: 'Public Grievance Desk', desc: 'Lodge and track grievances.', avg: 480, cap: 20 },
    ],
  },
];

async function main(): Promise<void> {
  await connectDB();
  logger.info('Seeding 4 premium businesses (restaurant, salon, hospital, education)...');

  // Ensure the demo owner exists (DB may have been cleared).
  let owner = await User.findOne({ email: 'owner@flowos.test' });
  if (!owner) {
    owner = await User.create({
      name: 'Olivia Owner',
      email: 'owner@flowos.test',
      passwordHash: await hashPassword('password123'),
      role: 'BUSINESS_OWNER',
    });
    logger.info('Created demo owner owner@flowos.test / password123');
  }

  let added = 0;
  let skipped = 0;

  for (const def of BUSINESSES) {
    if (await Business.findOne({ name: def.name })) {
      skipped += 1;
      continue;
    }

    const biz = await Business.create({
      name: def.name,
      category: def.category,
      description: def.description,
      ownerId: owner._id,
      address: def.address,
      phone: def.phone,
      location: { type: 'Point', coordinates: def.coords },
      logoUrl: def.image,
      hours: def.hours,
      status: 'ACTIVE',
      ratingAvg: def.ratingAvg,
      ratingCount: def.ratingCount,
    });

    await StaffMember.create({
      userId: owner._id,
      businessId: biz._id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    for (const q of def.queues) {
      await Queue.create({
        businessId: biz._id,
        name: q.name,
        description: q.desc,
        avgServiceSec: q.avg,
        maxCapacity: q.cap,
        status: 'OPEN',
      });
    }

    added += 1;
    logger.info(`  + ${def.name} (${def.category}) — ${def.queues.length} services`);
  }

  logger.info(
    `Done — added: ${added}, skipped: ${skipped}, total businesses now: ${await Business.countDocuments()}`,
  );
  await disconnectDB();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'seed-four-businesses failed');
    process.exit(1);
  });
