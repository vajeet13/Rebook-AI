import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getBolnaExecutionInternal,
  triggerBolnaCallDirect,
  triggerConfirmationCalls,
} from '../controllers/internalController.js';

const router = Router();

router.post('/trigger-confirmation-calls', requireAuth, triggerConfirmationCalls);
router.post('/trigger-bolna-call/:appointmentId', requireAuth, triggerBolnaCallDirect);
router.get('/bolna-executions/:appointmentId', requireAuth, getBolnaExecutionInternal);

export default router;
