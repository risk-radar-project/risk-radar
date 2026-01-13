import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { inboxService } from "../services/inbox-service";
import { notificationDispatcher } from "../services/notification-dispatcher";
import { logger } from "../utils/logger";
import { NotificationEvent } from "../types/events";
import { auditClient } from "../clients/audit-client";
import { authzClient } from "../clients/authz-client";

/**
 * Lists notifications for the authenticated user with pagination.
 * 
 * @param req - Express request object containing pagination parameters.
 * @param res - Express response object.
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
    const userId: string = req.context?.userId ?? "";
    if (userId.length === 0) {
        res.status(400).json({ error: "Missing X-User-ID header" });
        return;
    }

    const page = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const isReadParam = req.query.isRead as string | undefined;
    const isRead = typeof isReadParam === "string"
        ? isReadParam === "true"
        : undefined;

    const result = await inboxService.list(userId, page, limit, isRead);

    // Record audit log for accessing inbox
    await auditClient.recordUserAction({
        action: "notifications.inbox.list",
        actorId: userId,
        metadata: {
            page,
            limit,
            isRead: typeof isRead === "boolean" ? isRead : null,
            total: result.total
        }
    });

    res.json({
        data: result.data,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    });
}

/**
 * Marks a specific notification as read.
 * 
 * @param req - Express request object containing notification ID.
 * @param res - Express response object.
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
    const userId: string = req.context?.userId ?? "";
    if (userId.length === 0) {
        res.status(400).json({ error: "Missing X-User-ID header" });
        return;
    }

    const notificationId = req.params.id;
    if (!notificationId) {
        res.status(400).json({ error: "Missing notification id" });
        return;
    }

    const updated = await inboxService.markAsRead(notificationId, userId as string);
    if (!updated) {
        res.status(404).json({ error: "Notification not found" });
        return;
    }

    await auditClient.recordUserAction({
        action: "notifications.inbox.mark_read",
        actorId: userId,
        targetId: notificationId,
        metadata: {
            previousState: "unread",
            newState: "read"
        }
    });

    res.status(204).send();
}

/**
 * Marks a specific notification as unread.
 * 
 * @param req - Express request object containing notification ID.
 * @param res - Express response object.
 */
export async function markAsUnread(req: Request, res: Response): Promise<void> {
    const userId: string = req.context?.userId ?? "";
    if (userId.length === 0) {
        res.status(400).json({ error: "Missing X-User-ID header" });
        return;
    }

    const notificationId = req.params.id;
    if (!notificationId) {
        res.status(400).json({ error: "Missing notification id" });
        return;
    }

    const updated = await inboxService.markAsUnread(notificationId, userId as string);
    if (!updated) {
        res.status(404).json({ error: "Notification not found" });
        return;
    }

    await auditClient.recordUserAction({
        action: "notifications.inbox.mark_unread",
        actorId: userId,
        targetId: notificationId,
        metadata: {
            previousState: "read",
            newState: "unread"
        }
    });

    res.status(204).send();
}

/**
 * Handles fallback notification sending when direct channels are unavailable.
 * Requires special permission `notifications:send`.
 * 
 * @param req - Express request object containing the notification payload.
 * @param res - Express response object.
 */
export async function fallbackSend(req: Request, res: Response): Promise<void> {
    const userId: string = req.context?.userId ?? "";
    if (userId.length === 0) {
        res.status(400).json({ error: "Missing X-User-ID header" });
        return;
    }

    // Check permission - strictly require notifications:send capability
    const allowed = await authzClient.hasPermission(userId, "notifications:send");
    if (!allowed) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
    }

    const payload = req.body as Partial<NotificationEvent>;
    const event: NotificationEvent = {
        eventId: payload.eventId || uuidv4(),
        eventType: payload.eventType as NotificationEvent["eventType"],
        userId: payload.userId as string,
        initiatorId: payload.initiatorId || null,
        payload: payload.payload || {},
        source: payload.source || "fallback-endpoint",
    };

    try {
        await notificationDispatcher.dispatch(event);
        logger.info("Fallback notification dispatched", {
            eventId: event.eventId,
            eventType: event.eventType,
        });
        res.status(202).json({ status: "accepted", eventId: event.eventId });
    } catch (error) {
        logger.error("Fallback dispatch failed", {
            eventId: event.eventId,
            error: error instanceof Error ? error.message : "unknown error"
        });
        res.status(500).json({ error: "Failed to dispatch notification" });
    }
}
