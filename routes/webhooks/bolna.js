import { Router } from 'express';
import { handleBolnaWebhook } from '../../controllers/bolnaWebhookController.js';
import { verifyBolnaWebhook } from '../../middleware/verifyBolnaWebhook.js';

const router = Router();

router.post('/', verifyBolnaWebhook, handleBolnaWebhook);

export default router;
