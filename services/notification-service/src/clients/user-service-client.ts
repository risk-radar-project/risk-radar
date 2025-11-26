import axios, { AxiosInstance } from "axios";
import { config } from "../config/config";
import { logger } from "../utils/logger";

class UserServiceClient {
    private http: AxiosInstance;
    private readonly maxAttempts = 3;
    private readonly baseDelayMs = 150;

    constructor() {
        this.http = axios.create({
            baseURL: config.userServiceBaseUrl,
            timeout: 5000,
        });
    }

    async getUserEmail(userId: string): Promise<string | null> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                const response = await this.http.get(`/internal/users/${userId}`);
                const email = response.data?.email || response.data?.contact?.email;
                if (typeof email === "string" && email.length > 0) {
                    return email;
                }
                logger.warn("User service responded without email", { userId });
                return null;
            } catch (error) {
                lastError = error;
                logger.warn("Failed to fetch user email attempt", {
                    userId,
                    attempt,
                    maxAttempts: this.maxAttempts,
                    error: error instanceof Error ? error.message : "unknown error"
                });

                if (attempt === this.maxAttempts) {
                    break;
                }

                const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
                await this.delay(delay);
            }
        }

        logger.error("Giving up on fetching user email", {
            userId,
            attempts: this.maxAttempts,
            error: lastError instanceof Error ? lastError.message : "unknown error"
        });
        return null;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const userServiceClient = new UserServiceClient();
