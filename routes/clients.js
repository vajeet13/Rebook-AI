import { Router } from 'express';
import {
  createClient,
  getClientById,
  listClients,
  patchClient,
} from '../controllers/clientController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/', requireAuth, createClient);
router.get('/', requireAuth, listClients);
router.get('/:clientId', requireAuth, getClientById);
router.patch('/:clientId', requireAuth, patchClient);

export default router;
