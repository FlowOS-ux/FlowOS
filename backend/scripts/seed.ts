/**
 * FlowOS - scripts/seed.ts
 * Seeds the configured MongoDB (MONGODB_URI) with demo data:
 * categories, an admin, a business owner with an ACTIVE business + queues,
 * a staff member, and customers. Idempotent: clears the relevant collections first.
 *
 * Run: `npm run seed`
 */
import { connectDB, disconnectDB } from '../src/config/db';
import {
  User,
  Business,
  StaffMember,
  Queue,
  Category,
  QueueEntry,
  Appointment,
  Review,
  Notification,
  SavedBusiness,
} from '../src/models';
import { hashPassword } from '../src/lib/password';
import { logger } from '../src/lib/logger';

const CATEGORIES = [
  { key: 'HOSPITAL', label: 'Hospital', icon: 'hospital', sortOrder: 1 },
  { key: 'BANK', label: 'Bank', icon: 'bank', sortOrder: 2 },
  { key: 'RESTAURANT', label: 'Restaurant', icon: 'restaurant', sortOrder: 3 },
  { key: 'SALON', label: 'Salon', icon: 'salon', sortOrder: 4 },
  { key: 'GOVERNMENT', label: 'Government Office', icon: 'gov', sortOrder: 5 },
];

async function seed(): Promise<void> {
  await connectDB();
  logger.info('Seeding database...');

  // Clean slate for demo data.
  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    StaffMember.deleteMany({}),
    Queue.deleteMany({}),
    Category.deleteMany({}),
    QueueEntry.deleteMany({}),
    Appointment.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    SavedBusiness.deleteMany({}),
  ]);

  await Category.insertMany(CATEGORIES);

  const password = await hashPassword('password123');
  const adminPassword = await hashPassword('12345678ct');

  // Seeded accounts are pre-verified so they can log in without the email OTP flow.
  // The single admin is the only PLATFORM_ADMIN (admin self-registration is disabled).
  const [admin, owner, staff, customer] = await User.create([
    { name: 'Platform Admin', email: 'sreelekhaac2427@gmail.com', passwordHash: adminPassword, role: 'PLATFORM_ADMIN', emailVerified: true },
    { name: 'Olivia Owner', email: 'owner@flowos.test', passwordHash: password, role: 'BUSINESS_OWNER', emailVerified: true },
    { name: 'Sam Staff', email: 'staff@flowos.test', passwordHash: password, role: 'STAFF', emailVerified: true },
    { name: 'Carl Customer', email: 'customer@flowos.test', passwordHash: password, role: 'CUSTOMER', emailVerified: true },
  ]);

  const business = await Business.create({
    name: 'City Health Clinic',
    category: 'HOSPITAL',
    description: 'Walk-in clinic and general consultations.',
    ownerId: owner.id,
    address: '12 Market Street',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // [lng, lat]
    phone: '+10000000000',
    status: 'APPROVED',
    approvedAt: new Date(),
    approvedBy: admin.id,
    hours: [
      { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00' },
    ],
  });

  await StaffMember.create([
    { userId: owner.id, businessId: business.id, role: 'OWNER', status: 'ACTIVE' },
    { userId: staff.id, businessId: business.id, role: 'STAFF', status: 'ACTIVE' },
  ]);

  await Queue.create([
    { businessId: business.id, name: 'General Consultation', avgServiceSec: 300, status: 'OPEN' },
    { businessId: business.id, name: 'Pharmacy Pickup', avgServiceSec: 120, status: 'OPEN' },
  ]);

  await SavedBusiness.create({ userId: customer.id, businessId: business.id });

  // A business awaiting verification so the admin dashboard has something to review.
  const pendingBusiness = await Business.create({
    name: 'Sunrise Dental Care',
    category: 'HOSPITAL',
    description: 'New dental clinic awaiting verification.',
    ownerId: owner.id,
    address: '88 Lake View Road',
    location: { type: 'Point', coordinates: [78.4867, 17.385] }, // Hyderabad
    phone: '+10000000001',
    status: 'PENDING_VERIFICATION',
    hours: [
      { dayOfWeek: 1, openTime: '10:00', closeTime: '18:00' },
      { dayOfWeek: 2, openTime: '10:00', closeTime: '18:00' },
    ],
  });
  await StaffMember.create({
    userId: owner.id,
    businessId: pendingBusiness.id,
    role: 'OWNER',
    status: 'ACTIVE',
  });
  await Queue.create({
    businessId: pendingBusiness.id,
    name: 'Walk-in',
    avgServiceSec: 600,
    status: 'OPEN',
  });

  logger.info('Seed complete:');
  logger.info('  Admin     sreelekhaac2427@gmail.com / 12345678ct');
  logger.info('  Owner     owner@flowos.test / password123');
  logger.info('  Staff     staff@flowos.test / password123');
  logger.info('  Customer  customer@flowos.test / password123');
  logger.info(`  Business  ${business.name} (${business.id}) — APPROVED`);
  logger.info(`  Pending   ${pendingBusiness.name} (${pendingBusiness.id}) — PENDING_VERIFICATION`);

  await disconnectDB();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  });
