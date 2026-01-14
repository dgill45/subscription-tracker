/**
 * Simple in-memory rate limiter using sliding window algorithm
 * For production, consider using Redis or DynamoDB for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Check if a request should be rate limited
 * @param key Unique identifier for the rate limit (e.g., IP address, email)
 * @param config Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    };
  }

  if (entry.count >= config.limit) {
    // Rate limit exceeded
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetIn,
    };
  }

  // Increment counter
  entry.count++;
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn,
  };
}

/**
 * Get client identifier from request (IP address or forwarded IP)
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - in production you'd want a better solution
  return "unknown";
}

// Preset configurations for different endpoints
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  register: { limit: 5, windowSeconds: 3600 }, // 5 per hour
  login: { limit: 10, windowSeconds: 900 }, // 10 per 15 minutes
  forgotPassword: { limit: 3, windowSeconds: 3600 }, // 3 per hour
  resetPassword: { limit: 5, windowSeconds: 3600 }, // 5 per hour
  verifyEmail: { limit: 10, windowSeconds: 3600 }, // 10 per hour
} as const;
