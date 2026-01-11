import axios from "axios"
import { config } from "../config/config.js"
import { logger } from "../logger/logger.js"

// Simple client or axios calls
// Assuming notification service is at http://notification-service:8086 or via env
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:8086"

export const notificationClient = {
    async sendMediaRejected(userId: string, filename: string, reason: string) {
        if (!userId) return
        try {
            await axios.post(`${NOTIFICATION_URL}/notifications/send`, {
                eventType: "MEDIA_REJECTED",
                userId,
                payload: {
                    title: "Plik odrzucony",
                    body: `Twój plik (${filename}) został odrzucony. Powód: ${reason}`
                }
            })
        } catch (err) {
            logger.warn("Failed to send MEDIA_REJECTED notification", { err })
        }
    },

    async sendMediaFlaggedNSFW(userId: string, filename: string) {
        if (!userId) return
        try {
            await axios.post(`${NOTIFICATION_URL}/notifications/send`, {
                eventType: "MEDIA_FLAGGED_NSFW",
                userId,
                payload: {
                    title: "Plik oznaczony jako wrażliwy",
                    body: `Twój plik (${filename}) został oznaczony jako zawierający treści wrażliwe (NSFW).`
                }
            })
        } catch (err) {
            logger.warn("Failed to send MEDIA_FLAGGED_NSFW notification", { err })
        }
    }
}
