import { Router } from 'express';
import * as healthController from '../controllers/health-controller';

const router = Router();

// GET /status - Health check
router.get('/status', healthController.healthCheck);

export default router;
