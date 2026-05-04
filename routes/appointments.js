import { Router } from 'express';
import {
  completeAppointment,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointmentSchedule,
} from '../controllers/appointmentController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/', requireAuth, createAppointment);
router.get('/', requireAuth, listAppointments);
router.patch('/:appointmentId/complete', requireAuth, completeAppointment);
router.patch('/:appointmentId', requireAuth, updateAppointmentSchedule);
router.get('/:appointmentId', requireAuth, getAppointmentById);

export default router;
