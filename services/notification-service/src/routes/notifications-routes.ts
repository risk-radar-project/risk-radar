import { Router } from "express";
import { listNotifications, markAsRead, markAsUnread, fallbackSend } from "../controllers/notifications-controller";
import { validateRequest } from "../middleware/validation";
import {
    fallbackSendSchema,
    listNotificationsQuerySchema,
    notificationIdParamsSchema,
} from "../validation/schemas";

const router = Router();

/**
 * GET /
 * Retrieval of user notifications with pagination.
 */
router.get("/",
    validateRequest({ query: listNotificationsQuerySchema }),
    listNotifications
);

/**
 * POST /send
 * Fallback endpoint for triggering notifications when Kafka is unavailable.
 * Requires `notifications:send` permission.
 */
router.post("/send",
    validateRequest({ body: fallbackSendSchema }),
    fallbackSend
);

/**
 * POST /:id/read
 * Mark a specific notification as read.
 */
router.post("/:id/read",
    validateRequest({ params: notificationIdParamsSchema }),
    markAsRead
);

/**
 * POST /:id/unread
 * Mark a specific notification as unread.
 */
router.post("/:id/unread",
    validateRequest({ params: notificationIdParamsSchema }),
    markAsUnread
);

export default router;
