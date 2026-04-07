import express from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import emailTemplatesRoutes from './emailTemplates';
import wellnessRoutes from './wellness';
import storeRoutes from './store';
import purchasesRoutes from './purchases';
import usersRoutes from './users';
import googleChatRoutes from './googleChat';
import campaignsRoutes from './campaigns';
import bannersRoutes from './banners';
import gamesRoutes from './games';
import studioRoutes from './studio';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Mount all admin sub-routes
router.use(emailTemplatesRoutes);
router.use(wellnessRoutes);
router.use(storeRoutes);
router.use(purchasesRoutes);
router.use(usersRoutes);
router.use(googleChatRoutes);
router.use(campaignsRoutes);
router.use(bannersRoutes);
router.use('/games', gamesRoutes);
router.use(studioRoutes);

export default router;
