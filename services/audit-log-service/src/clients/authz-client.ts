import axios from "axios";
import { config } from "../config/config";
import { logger } from "../utils/logger";

export class AuthzClient {
    private baseUrl: string;
    private timeoutMs: number;
    private retries: number;

    constructor() {
        this.baseUrl = config.authzServiceBaseUrl;
        this.timeoutMs = config.authzHttpTimeoutMs;
        this.retries = config.authzHttpRetries;
    }

    /**
     * Checks if a user has a specific permission.
     * @param userId The ID of the user to check (from X-User-ID header)
     * @param permission The permission string (e.g. "audit:view")
     * @returns boolean
     */
    async hasPermission(userId: string, permission: string): Promise<boolean> {
        if (!userId) {
            return false;
        }

        const url = `${this.baseUrl}/has-permission`;
        
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                const response = await axios.get(url, {
                    params: { permission },
                    headers: { "X-User-ID": userId },
                    timeout: this.timeoutMs
                });
                
                // Expecting { has_permission: true/false }
                return Boolean(response.data?.has_permission);
            } catch (error: any) {
                const msg = error.message;
                if (attempt === this.retries) {
                    logger.error("Authz check failed", {
                        error: msg,
                        userId,
                        permission
                    });
                    return false; 
                }
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
            }
        }
        return false;
    }
}

export const authzClient = new AuthzClient();
