/**
 * FlowOS - scripts/seed-demo-businesses.ts
 * Adds 10 demo businesses (idempotent — skips any whose name already exists) with
 * realistic profiles, 2-3 queues each, and sample waiting entries / reviews /
 * notifications / analytics so the app demos richly. Existing data is untouched.
 * Usage: tsx scripts/seed-demo-businesses.ts   (run `npm run seed` first)
 */
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
  type QueueDoc,
  type UserDoc,
} from '../src/models/index.js';
import { hashPassword } from '../src/lib/password.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowos';

// Curated luxury Unsplash photos by primary tag (verified to serve).
const IMG_PARAMS = '?w=800&h=400&fit=crop&q=80&auto=format';
const UNSPLASH_BY_TAG: Record<string, string> = {
  hospital: 'photo-1516549655169-df83a0774514',
  clinic: 'photo-1538108149393-fbbd81895907',
  bank: 'photo-1556742049-0cfed4f6a45d',
  restaurant: 'photo-1414235077428-338989a2e8c0',
  cafe: 'photo-1554118811-1e0d58224f24',
  salon: 'photo-1521590832167-7bcbfaa6381f',
  spa: 'photo-1540555700478-4be289fbecef',
  government: 'photo-1486406146926-c627a92ad1ab',
  university: 'photo-1562774053-701939374585',
};
const img = (keywords: string, _lock: number): string => {
  const tag = keywords.split(',')[0];
  const id = UNSPLASH_BY_TAG[tag] ?? UNSPLASH_BY_TAG.restaurant;
  return `https://images.unsplash.com/${id}${IMG_PARAMS}`;
};

type Hour = { dayOfWeek: number; openTime?: string; closeTime?: string; isClosed: boolean };
const hours = (open: string, close: string, closedDays: number[]): Hour[] =>
  Array.from({ length: 7 }, (_, d) =>
    closedDays.includes(d)
      ? { dayOfWeek: d, isClosed: true }
      : { dayOfWeek: d, openTime: open, closeTime: close, isClosed: false },
  );

const HOURS = {
  hospital: hours('08:00', '20:00', []),
  clinic: hours('09:00', '18:00', [0]),
  bank: hours('10:00', '16:00', [0]),
  restaurant: hours('11:00', '23:00', []),
  salon: hours('10:00', '20:00', [1]),
  government: hours('10:00', '17:00', [0]),
  education: hours('09:00', '17:00', [0]),
};

interface QueueDef {
  name: string;
  desc: string;
  avg: number; // avg service seconds
  cap: number; // max waiting capacity
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
  reviews: { rating: number; comment: string }[];
}

const BUSINESSES: BizDef[] = [
  {
    name: 'CityCare Hospital',
    category: 'HOSPITAL',
    description: 'Multispeciality hospital offering OPD consultations, diagnostics, and pharmacy.',
    address: 'Madhapur, Hyderabad',
    phone: '+91 40 2345 6789',
    coords: [78.3915, 17.4483],
    ratingAvg: 4.3,
    ratingCount: 312,
    image: img('hospital,clinic', 31),
    hours: HOURS.hospital,
    queues: [
      { name: 'OPD Registration', desc: 'Register for an outpatient consultation.', avg: 240, cap: 50 },
      { name: 'Pharmacy Pickup', desc: 'Collect prescribed medicines.', avg: 120, cap: 30 },
      { name: 'Lab Sample Collection', desc: 'Blood and diagnostic sample collection.', avg: 180, cap: 40 },
    ],
    reviews: [
      { rating: 5, comment: 'Quick OPD process and very helpful staff.' },
      { rating: 4, comment: 'Clean facility, slight wait at the pharmacy.' },
    ],
  },
  {
    name: 'Sunrise Multispeciality Clinic',
    category: 'HOSPITAL',
    description: 'Neighbourhood clinic with general physicians and visiting specialists.',
    address: 'Kondapur, Hyderabad',
    phone: '+91 40 2987 6543',
    coords: [78.3677, 17.4615],
    ratingAvg: 4.1,
    ratingCount: 156,
    image: img('clinic,doctor', 32),
    hours: HOURS.clinic,
    queues: [
      { name: 'General Consultation', desc: 'See a general physician.', avg: 300, cap: 30 },
      { name: 'Specialist Consultation', desc: 'Visiting specialist appointments.', avg: 420, cap: 20 },
    ],
    reviews: [
      { rating: 4, comment: 'Doctors are patient and thorough.' },
      { rating: 4, comment: 'Easy to book and short waiting time.' },
    ],
  },
  {
    name: 'TrustBank Branch',
    category: 'BANK',
    description: 'Full-service retail bank branch for deposits, accounts, and loans.',
    address: 'Begumpet, Hyderabad',
    phone: '+91 40 2776 1200',
    coords: [78.4691, 17.4435],
    ratingAvg: 4.0,
    ratingCount: 204,
    image: img('bank,building', 33),
    hours: HOURS.bank,
    queues: [
      { name: 'Cash Deposit / Withdrawal', desc: 'Teller counter for cash transactions.', avg: 180, cap: 40 },
      { name: 'Account Services', desc: 'Open/update accounts, KYC, cards.', avg: 300, cap: 25 },
      { name: 'Loan Enquiry', desc: 'Personal and home loan enquiries.', avg: 600, cap: 15 },
    ],
    reviews: [
      { rating: 4, comment: 'Smooth token system, organised counters.' },
      { rating: 3, comment: 'Loan desk can get busy in the mornings.' },
    ],
  },
  {
    name: 'Unity Bank Service Center',
    category: 'BANK',
    description: 'Service center for everyday banking and customer support.',
    address: 'Secunderabad, Hyderabad',
    phone: '+91 40 2784 3311',
    coords: [78.4983, 17.4399],
    ratingAvg: 3.9,
    ratingCount: 98,
    image: img('bank,counter', 34),
    hours: HOURS.bank,
    queues: [
      { name: 'Teller Services', desc: 'Deposits, withdrawals, drafts.', avg: 180, cap: 35 },
      { name: 'Customer Support', desc: 'Account help and dispute resolution.', avg: 300, cap: 20 },
    ],
    reviews: [
      { rating: 4, comment: 'Helpful staff at the support desk.' },
      { rating: 4, comment: 'Decent wait times for a busy branch.' },
    ],
  },
  {
    name: 'Spice Garden Restaurant',
    category: 'RESTAURANT',
    description: 'Family restaurant serving Indian and Hyderabadi cuisine.',
    address: 'HITEC City, Hyderabad',
    phone: '+91 98480 11223',
    coords: [78.3772, 17.4435],
    ratingAvg: 4.4,
    ratingCount: 421,
    image: img('restaurant,indian', 35),
    hours: HOURS.restaurant,
    queues: [
      { name: 'Walk-in Seating', desc: 'Join the waitlist for a table.', avg: 300, cap: 40 },
      { name: 'Takeaway Pickup', desc: 'Collect online/phone orders.', avg: 180, cap: 25 },
    ],
    reviews: [
      { rating: 5, comment: 'Great biryani and quick seating updates.' },
      { rating: 4, comment: 'Good food, peak hours are busy.' },
    ],
  },
  {
    name: 'Urban Bites Café',
    category: 'RESTAURANT',
    description: 'Casual café for coffee, snacks, and all-day breakfast.',
    address: 'Madhapur, Hyderabad',
    phone: '+91 98490 55667',
    coords: [78.395, 17.45],
    ratingAvg: 4.2,
    ratingCount: 233,
    image: img('cafe,coffee', 36),
    hours: HOURS.restaurant,
    queues: [
      { name: 'Walk-in Seating', desc: 'Grab a table when it is ready.', avg: 240, cap: 30 },
      { name: 'Order Pickup', desc: 'Collect your café order.', avg: 120, cap: 20 },
    ],
    reviews: [
      { rating: 4, comment: 'Cozy spot, friendly baristas.' },
      { rating: 5, comment: 'Best cold coffee in the area!' },
    ],
  },
  {
    name: 'Style Studio Salon',
    category: 'SALON',
    description: 'Unisex salon for haircuts, styling, and hair spa.',
    address: 'Kukatpally, Hyderabad',
    phone: '+91 90000 12345',
    coords: [78.3996, 17.4948],
    ratingAvg: 4.5,
    ratingCount: 187,
    image: img('salon,haircut', 37),
    hours: HOURS.salon,
    queues: [
      { name: 'Haircut & Styling', desc: 'Cut, trim, and styling.', avg: 1800, cap: 10 },
      { name: 'Hair Spa', desc: 'Treatment and conditioning.', avg: 2700, cap: 8 },
    ],
    reviews: [
      { rating: 5, comment: 'Loved the new haircut, great stylists.' },
      { rating: 4, comment: 'Premium service, book ahead on weekends.' },
    ],
  },
  {
    name: 'Glamour Lounge',
    category: 'SALON',
    description: 'Salon & spa offering beauty services and relaxation therapies.',
    address: 'Manikonda, Hyderabad',
    phone: '+91 90000 67890',
    coords: [78.387, 17.401],
    ratingAvg: 4.3,
    ratingCount: 142,
    image: img('spa,beauty', 38),
    hours: HOURS.salon,
    queues: [
      { name: 'Spa & Massage', desc: 'Relaxation and therapy sessions.', avg: 3600, cap: 6 },
      { name: 'Beauty Services', desc: 'Facials, manicure, pedicure.', avg: 2400, cap: 8 },
    ],
    reviews: [
      { rating: 4, comment: 'Very relaxing, clean and calm ambience.' },
      { rating: 5, comment: 'Excellent facial and friendly staff.' },
    ],
  },
  {
    name: 'Citizen Service Center',
    category: 'GOVERNMENT',
    description: 'Government one-stop center for certificates and public services.',
    address: 'Abids, Hyderabad',
    phone: '+91 40 2345 0000',
    coords: [78.4744, 17.3905],
    ratingAvg: 3.7,
    ratingCount: 89,
    image: img('government,office', 39),
    hours: HOURS.government,
    queues: [
      { name: 'Certificate Application', desc: 'Apply for civic certificates.', avg: 600, cap: 50 },
      { name: 'Document Verification', desc: 'Verify and attest documents.', avg: 300, cap: 40 },
      { name: 'Grievance Desk', desc: 'File and track public grievances.', avg: 480, cap: 20 },
    ],
    reviews: [
      { rating: 4, comment: 'Token system reduced the chaos a lot.' },
      { rating: 3, comment: 'Process is clearer now but still slow.' },
    ],
  },
  {
    name: 'Student Service Center',
    category: 'EDUCATION',
    description: 'Campus services for admissions, fees, and examinations.',
    address: 'Tarnaka, Hyderabad',
    phone: '+91 40 2700 4567',
    coords: [78.5253, 17.4256],
    ratingAvg: 4.0,
    ratingCount: 76,
    image: img('university,campus', 40),
    hours: HOURS.education,
    queues: [
      { name: 'Admissions Enquiry', desc: 'Course and admission guidance.', avg: 420, cap: 40 },
      { name: 'Fee Payment', desc: 'Pay tuition and other fees.', avg: 180, cap: 60 },
      { name: 'Exam / Certificate Desk', desc: 'Hall tickets and certificates.', avg: 360, cap: 30 },
    ],
    reviews: [
      { rating: 4, comment: 'Fee payment line moves quickly now.' },
      { rating: 4, comment: 'Helpful for admission queries.' },
    ],
  },
];

const DEMO_USERS: [string, string][] = [
  ['Aarav Kumar', 'demo1@flowos.test'],
  ['Diya Sharma', 'demo2@flowos.test'],
  ['Ishaan Reddy', 'demo3@flowos.test'],
  ['Ananya Rao', 'demo4@flowos.test'],
  ['Vihaan Patel', 'demo5@flowos.test'],
  ['Saanvi Nair', 'demo6@flowos.test'],
  ['Kabir Singh', 'demo7@flowos.test'],
  ['Myra Iyer', 'demo8@flowos.test'],
];

async function addWaiting(
  queue: QueueDoc,
  businessId: Types.ObjectId,
  users: UserDoc[],
): Promise<void> {
  let ticket = queue.ticketCounter ?? 0;
  for (let i = 0; i < users.length; i++) {
    ticket += 1;
    await QueueEntry.create({
      queueId: queue._id,
      businessId,
      userId: users[i]._id,
      ticketNumber: ticket,
      status: 'WAITING',
      joinedAt: new Date(Date.now() - (users.length - i) * 5 * 60 * 1000),
    });
  }
  queue.ticketCounter = ticket;
  await Queue.updateOne({ _id: queue._id }, { $set: { ticketCounter: ticket } });
}

async function main(): Promise<void> {
  await mongoose.connect(URI);

  const owner = await User.findOne({ email: 'owner@flowos.test' });
  if (!owner) {
    // eslint-disable-next-line no-console
    console.error('Seed owner (owner@flowos.test) not found. Run `npm run seed` first.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const seedCustomer = await User.findOne({ email: 'customer@flowos.test' });

  // Ensure a pool of demo customers exists (for entries / reviews).
  const pwd = await hashPassword('password123');
  const demoUsers: UserDoc[] = [];
  for (const [name, email] of DEMO_USERS) {
    let u = await User.findOne({ email });
    if (!u) u = await User.create({ name, email, passwordHash: pwd, role: 'CUSTOMER' });
    demoUsers.push(u);
  }

  let added = 0;
  let skipped = 0;
  let cityCareFirstQueue: QueueDoc | null = null;

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
    await StaffMember.create({ userId: owner._id, businessId: biz._id, role: 'OWNER', status: 'ACTIVE' });

    const queues: QueueDoc[] = [];
    for (const q of def.queues) {
      queues.push(
        await Queue.create({
          businessId: biz._id,
          name: q.name,
          description: q.desc,
          avgServiceSec: q.avg,
          maxCapacity: q.cap,
          status: 'OPEN',
        }),
      );
    }

    // Sample waiting entries: 3 on the first queue, 1 on the second.
    if (queues[0]) await addWaiting(queues[0], biz._id, [demoUsers[0], demoUsers[1], demoUsers[2]]);
    if (queues[1]) await addWaiting(queues[1], biz._id, [demoUsers[3]]);

    // Sample reviews (distinct demo users; unique per user+business).
    await Review.create({ businessId: biz._id, userId: demoUsers[4]._id, rating: def.reviews[0].rating, comment: def.reviews[0].comment });
    await Review.create({ businessId: biz._id, userId: demoUsers[5]._id, rating: def.reviews[1].rating, comment: def.reviews[1].comment });

    // A few recent analytics events so owner dashboards show real numbers.
    for (let i = 0; i < 5; i++) {
      await AnalyticsEvent.create({
        type: 'QUEUE_COMPLETED',
        businessId: biz._id,
        queueId: queues[0]._id,
        userId: demoUsers[i % demoUsers.length]._id,
        durationSec: 120 + Math.floor(Math.random() * 600),
      });
    }
    await AnalyticsEvent.create({ type: 'QUEUE_NO_SHOW', businessId: biz._id, queueId: queues[0]._id });

    if (def.name === 'CityCare Hospital') cityCareFirstQueue = queues[0];
    added += 1;
  }

  // Enrich the standard demo customer: a live waiting entry + a few notifications.
  if (seedCustomer && cityCareFirstQueue) {
    const already = await QueueEntry.findOne({
      queueId: cityCareFirstQueue._id,
      userId: seedCustomer._id,
      status: { $in: ['WAITING', 'CALLED', 'SERVING'] },
    });
    if (!already) {
      const ticket = (cityCareFirstQueue.ticketCounter ?? 0) + 1;
      await QueueEntry.create({
        queueId: cityCareFirstQueue._id,
        businessId: cityCareFirstQueue.businessId,
        userId: seedCustomer._id,
        ticketNumber: ticket,
        status: 'WAITING',
        joinedAt: new Date(),
      });
      await Queue.updateOne({ _id: cityCareFirstQueue._id }, { $set: { ticketCounter: ticket } });
    }
    if ((await Notification.countDocuments({ userId: seedCustomer._id })) === 0) {
      await Notification.create([
        { userId: seedCustomer._id, type: 'GENERIC', title: 'Welcome to FlowOS', body: 'Join queues remotely and track your turn in real time.', read: true },
        { userId: seedCustomer._id, type: 'POSITION_UPDATE', title: "You're almost up!", body: 'You are near the front at CityCare Hospital — OPD Registration.', data: { queueId: cityCareFirstQueue._id }, read: false },
        { userId: seedCustomer._id, type: 'QUEUE_CALLED', title: "It's your turn!", body: 'Please proceed to the OPD counter at CityCare Hospital.', data: { queueId: cityCareFirstQueue._id }, read: false },
      ]);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Demo businesses — added: ${added}, skipped (already existed): ${skipped}`);
  const total = await Business.countDocuments();
  // eslint-disable-next-line no-console
  console.log(`Total businesses now: ${total}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed-demo-businesses failed:', err);
  process.exit(1);
});
