
interface RateLimitEntry {
    count: number;
    resetTime: number;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(maxRequests: number = 10, windowMs: number = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    checkLimit(identifier: string): boolean {
        const now = Date.now();
        const entry = this.limits.get(identifier);

        if (!entry || now > entry.resetTime) {
            this.limits.set(identifier, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (entry.count >= this.maxRequests) {
            return false;
        }

        entry.count++;
        return true;
    }

    getRemainingRequests(identifier: string): number {
        const entry = this.limits.get(identifier);
        if (!entry || Date.now() > entry.resetTime) {
            return this.maxRequests;
        }
        return Math.max(0, this.maxRequests - entry.count);
    }
}

export const apiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
