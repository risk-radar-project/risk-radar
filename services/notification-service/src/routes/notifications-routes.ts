import { Router } from "express";
import { listNotifications, markAsRead, markAsUnread, fallbackSend } from "../controllers/notifications-controller";
import { validateRequest } from "../middleware/validation";
import {
    fallbackSendSchema,
    listNotificationsQuerySchema,
    notificationIdParamsSchema,
} from "../validation/schemas";

const router = Router();

router.get("/",
    validateRequest({ query: listNotificationsQuerySchema }),
    listNotifications
);

router.post("/send",
    validateRequest({ body: fallbackSendSchema }),
    fallbackSend
);

router.post("/:id/read",
    validateRequest({ params: notificationIdParamsSchema }),
    markAsRead
);

router.post("/:id/unread",
    validateRequest({ params: notificationIdParamsSchema }),
    markAsUnread
);

export default router;
