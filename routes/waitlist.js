import { Router } from 'express';
import { joinWaitlist, listWaitlist } from '../controllers/waitlistController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/', requireAuth, joinWaitlist);
router.get('/', requireAuth, listWaitlist);

export default router;
