/**
 * FlowOS - src/api/v1/index.ts
 * Aggregates every module router under /api/v1. Routers are added here as each
 * module is implemented.
 */
import { Router } from 'express';
import systemRoutes from '../../modules/system/system.routes';
import authRoutes from '../../modules/auth/auth.routes';
import userRoutes from '../../modules/users/users.routes';
import businessRoutes from '../../modules/businesses/businesses.routes';
import queueRoutes, { businessQueuesRouter } from '../../modules/queues/queues.routes';
import entryRoutes, { queueEntriesRouter } from '../../modules/entries/entries.routes';
import notificationRoutes from '../../modules/notifications/notifications.routes';
import appointmentRoutes, {
  businessAppointmentsRouter,
} from '../../modules/appointments/appointments.routes';
import reviewRoutes, { businessReviewsRouter } from '../../modules/reviews/reviews.routes';
import membershipRoutes, {
  businessStaffRouter,
} from '../../modules/memberships/memberships.routes';
import favoriteRoutes from '../../modules/favorites/favorites.routes';
import analyticsRoutes from '../../modules/analytics/analytics.routes';
import aiRoutes from '../../modules/ai/ai.routes';
import supportRoutes from '../../modules/support/support.routes';
import mediaRoutes from '../../modules/media/media.routes';

const router = Router();

// System (health / config)
router.use('/system', systemRoutes);

// Auth (register / login / refresh / logout / password reset / me)
router.use('/auth', authRoutes);

// Users (profile / settings / onboarding)
router.use('/users', userRoutes);

// Businesses (explore / details / register / manage)
router.use('/businesses', businessRoutes);

// Queues — business-scoped (list/create) + standalone (get/update by id)
router.use('/businesses/:businessId/queues', businessQueuesRouter);
router.use('/queues', queueRoutes);

// Queue entries — queue-scoped (join/list/call-next) + standalone (me/leave/serve/...)
router.use('/queues/:queueId', queueEntriesRouter);
router.use('/entries', entryRoutes);

// Notifications (feed + device tokens)
router.use('/notifications', notificationRoutes);

// Appointments (book / my list / manage) + business-scoped staff list
router.use('/businesses/:businessId/appointments', businessAppointmentsRouter);
router.use('/appointments', appointmentRoutes);

// Reviews (business-scoped list/create) + own review management
router.use('/businesses/:businessId/reviews', businessReviewsRouter);
router.use('/reviews', reviewRoutes);

// Staff management (business-scoped) + membership management
router.use('/businesses/:businessId/staff', businessStaffRouter);
router.use('/memberships', membershipRoutes);

// Saved Places (favorites)
router.use('/favorites', favoriteRoutes);

// Analytics (business dashboard + detailed)
router.use('/businesses/:businessId/analytics', analyticsRoutes);

// AI Assistant (Groq-backed chat)
router.use('/ai', aiRoutes);

// Help & Support (articles + tickets)
router.use('/support', supportRoutes);

// Media uploads (business logos / thumbnails, avatars)
router.use('/media', mediaRoutes);
// router.use('/businesses', businessRoutes);
// router.use('/queues', queueRoutes);
// router.use('/entries', entryRoutes);
// router.use('/notifications', notificationRoutes);
// ...

export default router;
