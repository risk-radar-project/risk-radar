export interface JwtPayload {
    exp?: number;
    iat?: number;
    sub?: string;
    userId?: string;
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
}

export function parseJwt(token: string): JwtPayload | null {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export function isTokenExpired(token: string): boolean {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return true;

    // exp is in seconds, Date.now() in milliseconds
    const currentTime = Math.floor(Date.now() / 1000);
    // Add a small buffer (e.g., 10 seconds) to avoid edge cases
    return payload.exp < currentTime + 10;
}
