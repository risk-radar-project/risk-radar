import { Router } from 'express';
import { statusController } from '../controllers/status-controller.js';

export const statusRouter = Router();

statusRouter.get('/', statusController.getStatus);
