import { Router } from 'express';
import * as auditController from '../controllers/audit-controller';
import { validateRequest } from '../middleware/validation';
import {
    createLogSchema,
    getLogsQuerySchema,
    getLogByIdSchema,
    anonymizeLogsSchema,
    anonymizeQuerySchema,
    loginHistoryQuerySchema,
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

// POST /logs/anonymize - Anonymize logs for a specific actor
router.post('/logs/anonymize',
    validateRequest({
        body: anonymizeLogsSchema,
        query: anonymizeQuerySchema
    }),
    auditController.anonymizeLogs
);

// GET /logs/login-history - recent successful login events for a user
router.get('/logs/login-history',
    validateRequest({ query: loginHistoryQuerySchema }),
    auditController.getLoginHistory
);

// GET /logs/:id - Get audit log by ID
router.get('/logs/:id',
    validateRequest({ params: getLogByIdSchema }),
    auditController.getLogById
);

export default router;
