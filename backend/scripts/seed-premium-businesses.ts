/**
 * FlowOS - scripts/seed-premium-businesses.ts
 * Seeds 10 premium Indian demo businesses (idempotent — skips any whose name exists)
 * with realistic profiles, 3 queues each, and sample entries / reviews / notifications
 * / analytics so the app looks fully functional for live demos.
 * Usage: tsx scripts/seed-premium-businesses.ts   (run `npm run seed` first)
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

const un = (id: string) => `https://images.unsplash.com/${id}?w=800&h=400&fit=crop&q=80&auto=format`;
const lf = (tags: string, lock: number) => `https://loremflickr.com/800/400/${tags}/all?lock=${lock}`;

type Hour = { dayOfWeek: number; openTime?: string; closeTime?: string; isClosed: boolean };
const hours = (open: string, close: string, closedDays: number[]): Hour[] =>
  Array.from({ length: 7 }, (_, d) =>
    closedDays.includes(d)
      ? { dayOfWeek: d, isClosed: true }
      : { dayOfWeek: d, openTime: open, closeTime: close, isClosed: false },
  );

const HOURS = {
  hospital: hours('08:00', '21:00', []),
  bank: hours('10:00', '17:00', [0]),
  restaurant: hours('12:00', '23:30', []),
  salon: hours('10:00', '20:00', [1]),
  education: hours('09:00', '17:00', [0]),
  government: hours('10:00', '17:00', [0]),
};

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
  coords: [number, number];
  ratingAvg: number;
  ratingCount: number;
  image: string;
  hours: Hour[];
  queues: QueueDef[];
  reviews: { rating: number; comment: string }[];
}

const BANK_Q: QueueDef[] = [
  { name: 'Account Services', desc: 'Open/update accounts, cards, and KYC.', avg: 300, cap: 30 },
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
const EDU_Q: QueueDef[] = [
  { name: 'Admissions Help Desk', desc: 'Course and admission guidance.', avg: 420, cap: 40 },
  { name: 'Student Services', desc: 'ID cards, letters, general help.', avg: 300, cap: 30 },
  { name: 'Fee & Records Support', desc: 'Fee payment and academic records.', avg: 240, cap: 50 },
];
const GOVT_Q: QueueDef[] = [
  { name: 'Document Verification', desc: 'Verify and attest documents.', avg: 360, cap: 50 },
  { name: 'Citizen Support', desc: 'General citizen assistance.', avg: 480, cap: 30 },
  { name: 'Certificate Services', desc: 'Apply for and collect certificates.', avg: 600, cap: 40 },
];

const BUSINESSES: BizDef[] = [
  {
    name: 'DFC Bank Prestige Branch',
    category: 'BANK',
    description: 'Premium banking branch offering priority services, wealth advisory, and lending.',
    address: 'Road No. 1, Banjara Hills, Hyderabad',
    phone: '+91 40 4455 1100',
    coords: [78.4347, 17.4156],
    ratingAvg: 4.4,
    ratingCount: 268,
    image: lf('india,bank', 71),
    hours: HOURS.bank,
    queues: BANK_Q,
    reviews: [
      { rating: 5, comment: 'Priority banking desk is quick and courteous.' },
      { rating: 4, comment: 'Smooth account services, premium experience.' },
    ],
  },
  {
    name: 'CT Bank Premier Service Center',
    category: 'BANK',
    description: 'Premier banking center with dedicated relationship managers and fast service.',
    address: 'Financial District, Nanakramguda, Hyderabad',
    phone: '+91 40 4455 2200',
    coords: [78.3421, 17.4159],
    ratingAvg: 4.2,
    ratingCount: 191,
    image: lf('india,bank', 72),
    hours: HOURS.bank,
    queues: BANK_Q,
    reviews: [
      { rating: 4, comment: 'Relationship manager was very helpful.' },
      { rating: 4, comment: 'Organised counters and short waits.' },
    ],
  },
  {
    name: 'Indian Accent Fine Dining',
    category: 'RESTAURANT',
    description: 'Contemporary Indian fine dining with curated tasting menus and impeccable service.',
    address: 'Jubilee Hills, Hyderabad',
    phone: '+91 40 4001 7777',
    coords: [78.4738, 17.4239],
    ratingAvg: 4.7,
    ratingCount: 523,
    image: un('photo-1585937421612-70a008356fbe'),
    hours: HOURS.restaurant,
    queues: REST_Q,
    reviews: [
      { rating: 5, comment: 'Exceptional tasting menu, world-class plating.' },
      { rating: 5, comment: 'Seamless reservation and warm hospitality.' },
    ],
  },
  {
    name: 'Masala Library Signature',
    category: 'RESTAURANT',
    description: 'Modern Indian gastronomy and signature thalis in an elegant, upscale setting.',
    address: 'Gachibowli, Hyderabad',
    phone: '+91 40 4002 8888',
    coords: [78.3489, 17.4401],
    ratingAvg: 4.6,
    ratingCount: 467,
    image: un('photo-1631452180519-c014fe946bc7'),
    hours: HOURS.restaurant,
    queues: REST_Q,
    reviews: [
      { rating: 5, comment: 'Signature thali is a must — beautifully done.' },
      { rating: 4, comment: 'Premium experience, busy on weekends.' },
    ],
  },
  {
    name: 'Lakmo Luxe Salon & Spa',
    category: 'SALON',
    description: 'Luxury salon and spa offering premium hair, beauty, and wellness rituals.',
    address: 'Road No. 36, Jubilee Hills, Hyderabad',
    phone: '+91 40 4567 9001',
    coords: [78.41, 17.43],
    ratingAvg: 4.6,
    ratingCount: 342,
    image: lf('india,spa', 73),
    hours: HOURS.salon,
    queues: SALON_Q,
    reviews: [
      { rating: 5, comment: 'Relaxing spa and excellent stylists.' },
      { rating: 4, comment: 'Premium service, book ahead on weekends.' },
    ],
  },
  {
    name: 'CT Elite Beauty Lounge',
    category: 'SALON',
    description: 'Elite beauty lounge for styling, grooming, and advanced skincare treatments.',
    address: 'Madhapur, Hyderabad',
    phone: '+91 40 4567 9002',
    coords: [78.3915, 17.4483],
    ratingAvg: 4.4,
    ratingCount: 210,
    image: lf('india,salon', 74),
    hours: HOURS.salon,
    queues: SALON_Q,
    reviews: [
      { rating: 5, comment: 'Great styling and a calm ambience.' },
      { rating: 4, comment: 'Skincare treatments are top-notch.' },
    ],
  },
  {
    name: 'Elite Hospital',
    category: 'HOSPITAL',
    description: 'Premium multispeciality hospital with advanced diagnostics and specialist care.',
    address: 'Somajiguda, Hyderabad',
    phone: '+91 40 2334 5000',
    coords: [78.4561, 17.4239],
    ratingAvg: 4.5,
    ratingCount: 890,
    image: lf('india,hospital', 75),
    hours: HOURS.hospital,
    queues: HEALTH_Q,
    reviews: [
      { rating: 5, comment: 'Efficient OPD and caring specialists.' },
      { rating: 4, comment: 'Clean, well-managed, minimal waiting.' },
    ],
  },
  {
    name: 'Fortis Signature Multispeciality Clinic',
    category: 'HOSPITAL',
    description: 'Signature multispeciality clinic delivering personalised, premium healthcare.',
    address: 'Kondapur, Hyderabad',
    phone: '+91 40 2334 6000',
    coords: [78.3677, 17.4615],
    ratingAvg: 4.3,
    ratingCount: 415,
    image: lf('india,clinic', 76),
    hours: HOURS.hospital,
    queues: HEALTH_Q,
    reviews: [
      { rating: 4, comment: 'Doctors are thorough and friendly.' },
      { rating: 4, comment: 'Smooth diagnostics and quick reports.' },
    ],
  },
  {
    name: 'Student Service Center',
    category: 'EDUCATION',
    description: 'Campus service center for admissions, student support, and academic records.',
    address: 'Tarnaka, Hyderabad',
    phone: '+91 40 2700 4567',
    coords: [78.5253, 17.4256],
    ratingAvg: 4.1,
    ratingCount: 132,
    image: lf('india,university', 77),
    hours: HOURS.education,
    queues: EDU_Q,
    reviews: [
      { rating: 4, comment: 'Fee payment line moves quickly now.' },
      { rating: 4, comment: 'Helpful for admission queries.' },
    ],
  },
  {
    name: 'Citizen Facilitation Centre',
    category: 'GOVERNMENT',
    description: 'One-stop government facilitation centre for citizen services and certificates.',
    address: 'Abids, Hyderabad',
    phone: '+91 40 2345 0000',
    coords: [78.4744, 17.3905],
    ratingAvg: 4.0,
    ratingCount: 176,
    image: un('photo-1587474260584-136574528ed5'),
    hours: HOURS.government,
    queues: GOVT_Q,
    reviews: [
      { rating: 4, comment: 'Token system made the process orderly.' },
      { rating: 4, comment: 'Document verification was quick.' },
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

async function addWaiting(queue: QueueDoc, businessId: Types.ObjectId, users: UserDoc[]): Promise<void> {
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

  const pwd = await hashPassword('password123');
  const demoUsers: UserDoc[] = [];
  for (const [name, email] of DEMO_USERS) {
    let u = await User.findOne({ email });
    if (!u) u = await User.create({ name, email, passwordHash: pwd, role: 'CUSTOMER' });
    demoUsers.push(u);
  }

  let added = 0;
  let skipped = 0;
  let featuredQueue: QueueDoc | null = null;

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

    if (queues[0]) await addWaiting(queues[0], biz._id, [demoUsers[0], demoUsers[1], demoUsers[2]]);
    if (queues[1]) await addWaiting(queues[1], biz._id, [demoUsers[3], demoUsers[4]]);
    if (queues[2]) await addWaiting(queues[2], biz._id, [demoUsers[5]]);

    await Review.create({ businessId: biz._id, userId: demoUsers[6]._id, rating: def.reviews[0].rating, comment: def.reviews[0].comment });
    await Review.create({ businessId: biz._id, userId: demoUsers[7]._id, rating: def.reviews[1].rating, comment: def.reviews[1].comment });

    for (let i = 0; i < 6; i++) {
      await AnalyticsEvent.create({
        type: 'QUEUE_COMPLETED',
        businessId: biz._id,
        queueId: queues[0]._id,
        userId: demoUsers[i % demoUsers.length]._id,
        durationSec: 120 + Math.floor(Math.random() * 720),
      });
    }
    await AnalyticsEvent.create({ type: 'QUEUE_NO_SHOW', businessId: biz._id, queueId: queues[0]._id });
    for (let i = 0; i < 5; i++) {
      await AnalyticsEvent.create({ type: 'QUEUE_JOIN', businessId: biz._id, queueId: queues[0]._id });
    }

    if (def.name === 'Elite Hospital') featuredQueue = queues[0];
    added += 1;
  }

  // Enrich the standard demo customer: a live waiting entry + notifications.
  if (seedCustomer && featuredQueue) {
    const already = await QueueEntry.findOne({
      queueId: featuredQueue._id,
      userId: seedCustomer._id,
      status: { $in: ['WAITING', 'CALLED', 'SERVING'] },
    });
    if (!already) {
      const ticket = (featuredQueue.ticketCounter ?? 0) + 1;
      await QueueEntry.create({
        queueId: featuredQueue._id,
        businessId: featuredQueue.businessId,
        userId: seedCustomer._id,
        ticketNumber: ticket,
        status: 'WAITING',
        joinedAt: new Date(),
      });
      await Queue.updateOne({ _id: featuredQueue._id }, { $set: { ticketCounter: ticket } });
    }
    if ((await Notification.countDocuments({ userId: seedCustomer._id })) === 0) {
      await Notification.create([
        { userId: seedCustomer._id, type: 'GENERIC', title: 'Welcome to FlowOS', body: 'Join queues remotely and track your turn in real time.', read: true },
        { userId: seedCustomer._id, type: 'POSITION_UPDATE', title: "You're almost up!", body: 'You are near the front at Elite Hospital — General Consultation.', data: { queueId: featuredQueue._id }, read: false },
        { userId: seedCustomer._id, type: 'QUEUE_CALLED', title: "It's your turn!", body: 'Please proceed to the consultation desk at Elite Hospital.', data: { queueId: featuredQueue._id }, read: false },
      ]);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Premium businesses — added: ${added}, skipped: ${skipped}, total now: ${await Business.countDocuments()}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed-premium-businesses failed:', err);
  process.exit(1);
});
