/**
 * FlowOS - scripts/seed-premium-demo.ts
 * Premium, globally-branded demo dataset for investor/client demos & screenshots.
 *
 * Resets demo collections, then creates 8 pre-APPROVED businesses in Hyderabad,
 * India (idempotent — skips any whose name already exists) across Banking,
 * Restaurant, Salon & Spa, Healthcare, and Jewellery — each with:
 *   - a realistic profile (premium people-free category interior image, contact, hours, email, website)
 *   - 3 queues with realistic capacity / average service time
 *   - live queue entries (WAITING / CALLED / SERVING) + historical COMPLETED / NO_SHOW
 *   - 15-30 reviews (ratings 4.2-5.0, recent dates) with consistent rating aggregates
 *   - notifications (queue updates, confirmations, reminders, completions)
 *   - backdated analytics events (today + last 7 days) powering the dashboards
 *
 * In this system "ACTIVE / APPROVED" maps to the single status `APPROVED` (the live
 * state). The business model has one image field (`logoUrl`) used as logo + cover.
 *
 * Usage:  npm run seed:demo        (run `npm run seed` first to create the admin)
 */
/* eslint-disable no-console */
import 'dotenv/config'; // load backend/.env (ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI)
import mongoose, { Types } from 'mongoose';
import {
  User,
  Business,
  StaffMember,
  Queue,
  QueueEntry,
  Review,
  Notification,
  AnalyticsEvent,
  SavedBusiness,
  type BusinessDoc,
  type QueueDoc,
  type UserDoc,
} from '../src/models/index.js';
import { hashPassword } from '../src/lib/password.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';
// Admin credentials come from the environment — never hardcoded/committed.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set the ${name} env var before running seed:demo`);
  return value;
}
const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

// ---- helpers ----
// Premium, people-free category interiors (curated Unsplash; all verified to load).
const un = (id: string) => `https://images.unsplash.com/${id}?w=1200&h=600&fit=crop&q=80&auto=format`;
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Peak-weighted hour of day (lunch + early evening), for realistic peak-hours charts.
const PEAK = [10, 11, 12, 12, 13, 13, 17, 17, 18, 18, 19];
const offHour = () => randInt(9, 20);
const peakHour = () => (Math.random() < 0.6 ? pick(PEAK) : offHour());

type Hour = { dayOfWeek: number; openTime?: string; closeTime?: string; isClosed: boolean };
const hours = (open: string, close: string, closed: number[]): Hour[] =>
  Array.from({ length: 7 }, (_, d) =>
    closed.includes(d)
      ? { dayOfWeek: d, isClosed: true }
      : { dayOfWeek: d, openTime: open, closeTime: close, isClosed: false },
  );

const HOURS = {
  bank: hours('09:00', '17:00', [0]),
  restaurant: hours('11:30', '23:30', []),
  salon: hours('10:00', '20:00', [1]),
  hospital: hours('08:00', '21:00', []),
  hotel: hours('00:00', '23:59', []),
  jewellery: hours('10:30', '20:00', []),
};

// Premium category interiors (no people). One image field (logoUrl) = logo + cover.
const IMAGES: Record<string, string[]> = {
  BANK: [un('photo-1554224155-6726b3ff858f'), un('photo-1556742502-ec7c0e9f34b1')],
  RESTAURANT: [un('photo-1585937421612-70a008356fbe'), un('photo-1631452180519-c014fe946bc7')],
  SALON: [un('photo-1560066984-138dadb4c035'), un('photo-1540555700478-4be289fbecef')],
  HOSPITAL: [un('photo-1519494026892-80bbd2d6fd0d'), un('photo-1538108149393-fbbd81895907')],
  HOTEL: [un('photo-1566073771259-6a8506099945'), un('photo-1551882547-ff40c63fe5fa')],
  JEWELLERY: [un('photo-1515562141207-7a88fb7ce338'), un('photo-1605100804763-247f67b3557e')],
};

interface QueueDef {
  name: string;
  desc: string;
  avg: number;
  cap: number;
}
const BANK_Q: QueueDef[] = [
  { name: 'Account Services', desc: 'Open or update accounts, cards, and KYC.', avg: 300, cap: 30 },
  { name: 'Loan Consultation', desc: 'Personal, home, and business loan advisory.', avg: 900, cap: 12 },
  { name: 'Priority Banking', desc: 'Dedicated desk for premium customers.', avg: 420, cap: 15 },
];
const REST_Q: QueueDef[] = [
  { name: 'Walk-in Dining', desc: 'Join the waitlist for a table.', avg: 600, cap: 40 },
  { name: 'Table Reservation', desc: 'Confirm your booked table.', avg: 300, cap: 25 },
  { name: 'Private Dining', desc: 'Exclusive private dining rooms.', avg: 1200, cap: 8 },
];
const SALON_Q: QueueDef[] = [
  { name: 'Hair & Styling', desc: 'Cut, colour, and styling.', avg: 1800, cap: 12 },
  { name: 'Beauty Treatments', desc: 'Facials, skincare, and grooming.', avg: 2400, cap: 10 },
  { name: 'Spa & Wellness', desc: 'Massage and wellness therapies.', avg: 3600, cap: 6 },
];
const HEALTH_Q: QueueDef[] = [
  { name: 'General Consultation', desc: 'See a general physician.', avg: 300, cap: 40 },
  { name: 'Specialist Consultation', desc: 'Consult a specialist doctor.', avg: 600, cap: 20 },
  { name: 'Diagnostics & Lab', desc: 'Sample collection and diagnostics.', avg: 240, cap: 35 },
];
const JEWEL_Q: QueueDef[] = [
  { name: 'Consultation Desk', desc: 'Browse collections with an advisor.', avg: 600, cap: 20 },
  { name: 'Custom Design Studio', desc: 'Bespoke jewellery design.', avg: 1800, cap: 8 },
  { name: 'Collection & Pickup', desc: 'Collect orders and repairs.', avg: 300, cap: 25 },
];

interface BizDef {
  name: string;
  category: string;
  ownerName: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  coords: [number, number];
  hours: Hour[];
  queues: QueueDef[];
}

// All businesses are located in Hyderabad, India.
const BUSINESSES: BizDef[] = [
  {
    name: 'Prestige Financial Center',
    category: 'BANK',
    ownerName: 'Rohan Kapoor',
    description:
      'Premier private banking and wealth management with concierge-level service for discerning clients.',
    address: 'Road No. 1, Banjara Hills, Hyderabad 500034',
    phone: '+91 40 4455 1100',
    email: 'concierge@prestigefinancial.com',
    website: 'https://prestigefinancial.com',
    coords: [78.4347, 17.4156],
    hours: HOURS.bank,
    queues: BANK_Q,
  },
  {
    name: 'The Grand Table',
    category: 'RESTAURANT',
    ownerName: 'Arjun Reddy',
    description:
      'Contemporary fine dining with a seasonal tasting menu and an award-winning wine cellar.',
    address: 'Road No. 12, Jubilee Hills, Hyderabad 500033',
    phone: '+91 40 4001 7777',
    email: 'reservations@thegrandtable.com',
    website: 'https://thegrandtable.com',
    coords: [78.4738, 17.4239],
    hours: HOURS.restaurant,
    queues: REST_Q,
  },
  {
    name: 'Signature Dining Lounge',
    category: 'RESTAURANT',
    ownerName: 'Sneha Iyer',
    description:
      'An elegant lounge for signature plates, craft cocktails, and curated wine pairings.',
    address: 'DLF Cyber City, Gachibowli, Hyderabad 500032',
    phone: '+91 40 4002 8888',
    email: 'dine@signaturelounge.com',
    website: 'https://signaturelounge.com',
    coords: [78.3489, 17.4401],
    hours: HOURS.restaurant,
    queues: REST_Q,
  },
  {
    name: 'Luxe Beauty & Wellness',
    category: 'SALON',
    ownerName: 'Priya Menon',
    description:
      'A luxury salon and wellness destination for hair, skin, and bespoke beauty rituals.',
    address: 'Road No. 36, Jubilee Hills, Hyderabad 500033',
    phone: '+91 40 4567 9001',
    email: 'care@luxebeauty.com',
    website: 'https://luxebeauty.com',
    coords: [78.41, 17.43],
    hours: HOURS.salon,
    queues: SALON_Q,
  },
  {
    name: 'Elite Spa Retreat',
    category: 'SALON',
    ownerName: 'Kavya Nair',
    description:
      'A serene spa retreat offering massage, hydrotherapy, and holistic wellness programs.',
    address: 'Hitech City Road, Madhapur, Hyderabad 500081',
    phone: '+91 40 4567 9002',
    email: 'relax@elitesparetreat.com',
    website: 'https://elitesparetreat.com',
    coords: [78.3915, 17.4483],
    hours: HOURS.salon,
    queues: SALON_Q,
  },
  {
    name: 'Elite Medical Center',
    category: 'HOSPITAL',
    ownerName: 'Dr. Vikram Rao',
    description:
      'A premium multispecialty medical center with advanced diagnostics and specialist care.',
    address: 'Raj Bhavan Road, Somajiguda, Hyderabad 500082',
    phone: '+91 40 2334 5000',
    email: 'appointments@elitemedical.com',
    website: 'https://elitemedical.com',
    coords: [78.4561, 17.4239],
    hours: HOURS.hospital,
    queues: HEALTH_Q,
  },
  {
    name: 'Signature Multispeciality Clinic',
    category: 'HOSPITAL',
    ownerName: 'Dr. Meera Joshi',
    description:
      'A signature multispeciality clinic delivering personalised, premium healthcare and diagnostics.',
    address: 'Sarath City Road, Kondapur, Hyderabad 500084',
    phone: '+91 40 2334 6000',
    email: 'care@signatureclinic.com',
    website: 'https://signatureclinic.com',
    coords: [78.3677, 17.4615],
    hours: HOURS.hospital,
    queues: HEALTH_Q,
  },
  {
    name: 'Hyderabad Heritage Jewellery',
    category: 'JEWELLERY',
    ownerName: 'Anita Deshmukh',
    description:
      'A heritage luxury jewellery house specialising in fine gold, diamonds, and bespoke design.',
    address: 'Road No. 10, Jubilee Hills, Hyderabad 500033',
    phone: '+91 40 6688 2000',
    email: 'contact@heritagejewellery.com',
    website: 'https://heritagejewellery.com',
    coords: [78.47, 17.426],
    hours: HOURS.jewellery,
    queues: JEWEL_Q,
  },
];

const CUSTOMER_NAMES = [
  'Emma Walsh', 'Liam Carter', 'Olivia Brooks', 'Noah Bennett', 'Ava Mitchell',
  'James Sullivan', 'Sophia Nguyen', 'Lucas Romano', 'Isabella Costa', 'Mason Clarke',
  'Mia Andersson', 'Ethan Walker', 'Charlotte Dubois', 'Henry Schmidt', 'Amelia Rossi',
  'Daniel Park', 'Grace O’Connor', 'Samuel Klein', 'Chloe Martin', 'David Cohen',
  'Zoe Tanaka', 'Benjamin Hayes', 'Layla Hassan', 'Oliver Novak', 'Nora Lindqvist',
  'Gabriel Silva', 'Hannah Weber', 'Adrian Kowalski', 'Maya Petrova', 'Leo Fontaine',
];

const REVIEW_COMMENTS = [
  'Exceptional service and a seamless experience from start to finish.',
  'The queue moved quickly and the staff were professional throughout.',
  'Premium, polished, and well organised — exactly what I expected.',
  'Booked ahead and was seen right on time. Highly recommend.',
  'Spotless facilities and a calm, welcoming atmosphere.',
  'Knowledgeable team and genuinely attentive service.',
  'Efficient process with almost no waiting. Very impressed.',
  'A truly premium experience — I will be returning.',
  'Clear communication and excellent attention to detail.',
  'Modern, comfortable, and impeccably run.',
  'Friendly staff and a smooth, stress-free visit.',
  'Top-tier service standards and a great first impression.',
  'Everything ran on schedule and the staff were courteous.',
  'Outstanding from booking to checkout — five stars.',
  'Professional, prompt, and beautifully maintained.',
  'The real-time updates made the whole visit effortless.',
  'Great value for a premium level of service.',
  'Quiet, refined, and extremely well managed.',
  'Helpful team that went the extra mile.',
  'A flawless visit — would recommend to anyone.',
];

// Weighted rating: mostly 5s and 4s, occasional 3 -> aggregate lands in ~4.4-4.8.
const reviewRating = (): number => {
  const r = Math.random();
  return r < 0.66 ? 5 : r < 0.93 ? 4 : 3;
};

type Raw = Record<string, unknown>;

/** Build queue entries (active + historical) for one queue; returns docs + last ticket. */
function buildEntries(
  queue: QueueDoc,
  businessId: Types.ObjectId,
  customers: UserDoc[],
): { entries: Raw[]; lastTicket: number } {
  const entries: Raw[] = [];
  let ticket = 0;
  const avg = queue.avgServiceSec ?? 300;

  // Historical COMPLETED over the last 7 days (customers may repeat across days).
  const completed = randInt(12, 22);
  for (let i = 0; i < completed; i++) {
    const joinedAt = new Date(Date.now() - randInt(1, 7) * 86_400_000 - randInt(0, 600) * 60_000);
    const waitSec = randInt(Math.round(avg * 0.4), Math.round(avg * 1.6));
    const calledAt = new Date(joinedAt.getTime() + waitSec * 1000);
    const servingAt = new Date(calledAt.getTime() + randInt(20, 120) * 1000);
    const serviceSec = randInt(Math.round(avg * 0.6), Math.round(avg * 1.4));
    const completedAt = new Date(servingAt.getTime() + serviceSec * 1000);
    ticket += 1;
    entries.push({
      queueId: queue._id,
      businessId,
      userId: pick(customers)._id,
      ticketNumber: ticket,
      status: 'COMPLETED',
      joinedAt,
      calledAt,
      servingAt,
      completedAt,
      nearNotified: true,
    });
  }
  // A couple of NO_SHOWs.
  for (let i = 0; i < randInt(1, 3); i++) {
    const joinedAt = new Date(Date.now() - randInt(1, 6) * 86_400_000 - randInt(0, 400) * 60_000);
    ticket += 1;
    entries.push({
      queueId: queue._id,
      businessId,
      userId: pick(customers)._id,
      ticketNumber: ticket,
      status: 'NO_SHOW',
      joinedAt,
      calledAt: new Date(joinedAt.getTime() + randInt(300, 1200) * 1000),
      nearNotified: true,
    });
  }

  // Active line — distinct customers (DB enforces one active entry per user per queue).
  const cap = queue.maxCapacity ?? 12;
  const waiting = Math.min(randInt(3, 8), Math.max(3, Math.floor(cap * 0.6)));
  const activeUsers = shuffle(customers).slice(0, waiting + 2);

  // One SERVING, one CALLED at the front.
  ticket += 1;
  entries.push({
    queueId: queue._id,
    businessId,
    userId: activeUsers[0]._id,
    ticketNumber: ticket,
    status: 'SERVING',
    joinedAt: minsAgo(randInt(20, 40)),
    calledAt: minsAgo(randInt(8, 15)),
    servingAt: minsAgo(randInt(1, 6)),
    nearNotified: true,
  });
  ticket += 1;
  entries.push({
    queueId: queue._id,
    businessId,
    userId: activeUsers[1]._id,
    ticketNumber: ticket,
    status: 'CALLED',
    joinedAt: minsAgo(randInt(12, 25)),
    calledAt: minsAgo(randInt(1, 4)),
    nearNotified: true,
  });
  // WAITING line, ascending join time -> stable positions.
  for (let i = 0; i < waiting; i++) {
    ticket += 1;
    entries.push({
      queueId: queue._id,
      businessId,
      userId: activeUsers[2 + i]._id,
      ticketNumber: ticket,
      status: 'WAITING',
      joinedAt: minsAgo((waiting - i) * randInt(2, 5)),
      nearNotified: i === 0,
    });
  }

  return { entries, lastTicket: ticket };
}

/** Backdated analytics events (today + last 7 days) that power the dashboards. */
function buildAnalytics(businessId: Types.ObjectId, queueIds: Types.ObjectId[], customers: UserDoc[]): Raw[] {
  const events: Raw[] = [];
  const push = (type: string, createdAt: Date, durationSec?: number) => {
    const e: Raw = {
      type,
      businessId,
      queueId: pick(queueIds),
      userId: pick(customers)._id,
      createdAt,
    };
    if (durationSec !== undefined) e.durationSec = durationSec;
    events.push(e);
  };

  for (let day = 0; day <= 6; day++) {
    const joins = randInt(18, 40);
    const completes = randInt(14, 30);
    const noShows = randInt(1, 4);
    const at = (): Date => {
      if (day === 0) return minsAgo(randInt(20, 22 * 60)); // within the last ~22h
      const d = new Date(Date.now() - day * 86_400_000);
      d.setHours(peakHour(), randInt(0, 59), 0, 0);
      return d;
    };
    for (let i = 0; i < joins; i++) push('QUEUE_JOIN', at());
    for (let i = 0; i < completes; i++) push('QUEUE_COMPLETED', at(), randInt(180, 2100));
    for (let i = 0; i < noShows; i++) push('QUEUE_NO_SHOW', at());
  }
  return events;
}

async function main(): Promise<void> {
  await mongoose.connect(URI);

  // 1) Reset demo data (keeps user accounts so logins survive).
  const cleared = await Promise.all([
    Business.deleteMany({}),
    Queue.deleteMany({}),
    QueueEntry.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    AnalyticsEvent.deleteMany({}),
    SavedBusiness.deleteMany({}),
    StaffMember.deleteMany({}),
  ]);
  console.log(`Cleared demo data (businesses removed: ${cleared[0].deletedCount}).`);

  // 2) Admin (approver) — create if `npm run seed` hasn't run.
  let admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    admin = await User.create({
      name: 'Platform Admin',
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: 'PLATFORM_ADMIN',
      emailVerified: true,
    });
    console.log('Created admin account.');
  }

  // 3) Customer pool (reused for entries + reviews + notifications).
  const custPwd = await hashPassword('password123');
  const customers: UserDoc[] = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const email = `customer${i + 1}@flowos.demo`;
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({
        name: CUSTOMER_NAMES[i],
        email,
        passwordHash: custPwd,
        role: 'CUSTOMER',
        emailVerified: true,
      });
    }
    customers.push(u);
  }

  const ownerPwd = await hashPassword('password123');
  const catIndex: Record<string, number> = {};
  let created = 0;
  let queueCount = 0;
  let reviewCount = 0;
  let entryCount = 0;
  let analyticsCount = 0;

  for (const def of BUSINESSES) {
    if (await Business.findOne({ name: def.name })) {
      console.log(`Skipped (exists): ${def.name}`);
      continue;
    }

    // Owner account (one per business) — distinct, realistic owner in the admin view.
    const ownerEmail = `owner.${slug(def.name)}@flowos.demo`;
    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      owner = await User.create({
        name: def.ownerName,
        email: ownerEmail,
        passwordHash: ownerPwd,
        role: 'BUSINESS_OWNER',
        emailVerified: true,
      });
    }

    const idx = catIndex[def.category] ?? 0;
    catIndex[def.category] = idx + 1;
    const imgs = IMAGES[def.category] ?? [];
    const image = imgs[idx % imgs.length];

    // Pre-approved business (status APPROVED == live/active) with audit trail.
    const biz: BusinessDoc = await Business.create({
      name: def.name,
      category: def.category,
      description: def.description,
      ownerId: owner._id,
      address: def.address,
      phone: def.phone,
      email: def.email,
      website: def.website,
      logoUrl: image,
      location: { type: 'Point', coordinates: def.coords },
      hours: def.hours,
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: admin._id,
    });
    await StaffMember.create({ userId: owner._id, businessId: biz._id, role: 'OWNER', status: 'ACTIVE' });

    // Queues + entries.
    const queues: QueueDoc[] = [];
    for (const q of def.queues) {
      const queue = await Queue.create({
        businessId: biz._id,
        name: q.name,
        description: q.desc,
        avgServiceSec: q.avg,
        maxCapacity: q.cap,
        status: 'OPEN',
      });
      const { entries, lastTicket } = buildEntries(queue, biz._id as Types.ObjectId, customers);
      if (entries.length) await QueueEntry.insertMany(entries);
      await Queue.updateOne({ _id: queue._id }, { $set: { ticketCounter: lastTicket } });
      entryCount += entries.length;
      queues.push(queue);
      queueCount += 1;
    }

    // Reviews (distinct customers) + consistent rating aggregate.
    const reviewers = shuffle(customers).slice(0, randInt(15, 30));
    const reviews: Raw[] = reviewers.map((u) => {
      const createdAt = new Date(Date.now() - randInt(0, 60) * 86_400_000 - randInt(0, 1439) * 60_000);
      return {
        businessId: biz._id,
        userId: u._id,
        rating: reviewRating(),
        comment: pick(REVIEW_COMMENTS),
        status: 'VISIBLE',
        createdAt,
        updatedAt: createdAt,
      };
    });
    await Review.collection.insertMany(reviews);
    const ratingAvg =
      Math.round((reviews.reduce((s, r) => s + (r.rating as number), 0) / reviews.length) * 10) / 10;
    await Business.updateOne(
      { _id: biz._id },
      { $set: { ratingAvg, ratingCount: reviews.length } },
    );
    reviewCount += reviews.length;

    // Notifications to a few customers (updates / confirmations / reminders / completions).
    const notifReceivers = shuffle(customers).slice(0, 6);
    const notifs: Raw[] = notifReceivers.flatMap((u, i) => {
      const base = randInt(1, 5) * 3600_000;
      return [
        {
          userId: u._id,
          type: 'POSITION_UPDATE',
          title: "You're almost up!",
          body: `You're near the front at ${def.name} — ${def.queues[0].name}.`,
          data: { businessId: biz._id },
          read: i % 2 === 0,
          createdAt: new Date(Date.now() - base),
          updatedAt: new Date(Date.now() - base),
        },
        {
          userId: u._id,
          type: i % 2 === 0 ? 'QUEUE_CALLED' : 'GENERIC',
          title: i % 2 === 0 ? "It's your turn!" : 'Booking confirmed',
          body:
            i % 2 === 0
              ? `Please proceed to the desk at ${def.name}.`
              : `Your booking at ${def.name} is confirmed.`,
          data: { businessId: biz._id },
          read: false,
          createdAt: new Date(Date.now() - base - 1800_000),
          updatedAt: new Date(Date.now() - base - 1800_000),
        },
      ];
    });
    await Notification.collection.insertMany(notifs);

    // Backdated analytics powering today's summary + 7-day charts.
    const analytics = buildAnalytics(
      biz._id as Types.ObjectId,
      queues.map((q) => q._id as Types.ObjectId),
      customers,
    );
    await AnalyticsEvent.collection.insertMany(analytics);
    analyticsCount += analytics.length;

    created += 1;
    console.log(`Added ${def.name} (${def.category}) — ${ratingAvg}★ from ${reviews.length} reviews`);
  }

  console.log('\nPremium demo seed complete:');
  console.log(`  Businesses : ${created} (all APPROVED) of ${await Business.countDocuments()} total`);
  console.log(`  Queues     : ${queueCount}`);
  console.log(`  Entries    : ${entryCount}`);
  console.log(`  Reviews    : ${reviewCount}`);
  console.log(`  Analytics  : ${analyticsCount} events`);
  console.log(`  Admin login: ${ADMIN_EMAIL} (password: ADMIN_PASSWORD env var)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('seed-premium-demo failed:', err);
  process.exit(1);
});
