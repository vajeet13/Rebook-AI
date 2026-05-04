import { Router } from 'express';
import {
  getUserById,
  getUserDetails,
  listUsers,
  updateMyProfile,
  updatePassword,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/me', requireAuth, getUserDetails);
router.post('/me', requireAuth, updateMyProfile);
router.post('/me/password', requireAuth, updatePassword);
router.get('/', requireAuth, requireRole('admin'), listUsers);
router.get('/:userId', requireAuth, requireRole('admin'), getUserById);

export default router;
