import { Router } from "express";
import { getStatus } from "../controllers/status-controller";

const router = Router();

/**
 * GET /
 * Health check endpoint returning status of service and dependencies (DB, Kafka, SMTP).
 */
router.get("/", getStatus);

export default router;
