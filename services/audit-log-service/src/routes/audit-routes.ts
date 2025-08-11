import { Router } from 'express';
import * as auditController from '../controllers/audit-controller';
import { validateRequest } from '../middleware/validation';
import {
    createLogSchema,
    getLogsQuerySchema,
    getLogByIdSchema,
    anonymizeLogsSchema,
    anonymizeQuerySchema,
} from '../validation/schemas';

const router = Router();

// POST /logs - Create audit log
router.post('/logs',
    validateRequest({ body: createLogSchema }),
    auditController.createLog
);

// GET /logs - Get audit logs with filters and pagination
router.get('/logs',
    validateRequest({ query: getLogsQuerySchema }),
    auditController.getLogs
);

// GET /logs/:id - Get audit log by ID
router.get('/logs/:id',
    validateRequest({ params: getLogByIdSchema }),
    auditController.getLogById
);

// POST /logs/anonymize - Anonymize logs for a specific actor
router.post('/logs/anonymize',
    validateRequest({
        body: anonymizeLogsSchema,
        query: anonymizeQuerySchema
    }),
    auditController.anonymizeLogs
);

export default router;
