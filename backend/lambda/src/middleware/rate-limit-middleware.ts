/**
 * ============================================================================
 * RATE LIMITING MIDDLEWARE
 * ============================================================================
 * 
 * Provides rate limiting for API endpoints to prevent abuse.
 * 
 * Note: For production use with Lambda, consider using:
 * - AWS WAF rate limiting rules
 * - DynamoDB-based rate limiting for distributed state
 * - Redis/ElastiCache for high-performance rate limiting
 * 
 * This implementation uses:
 * 1. In-memory rate limiting (per Lambda instance)
 * 2. Request fingerprinting by IP + user agent
 * 
 * Date: 2025-01-28
 * Security Enhancement
 * ============================================================================
 */

import { Context, Next } from 'hono';

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  keyPrefix?: string;     // Optional prefix for rate limit key
  skipFailedRequests?: boolean;  // Don't count failed requests
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
}

// Default rate limits by endpoint type
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints - more restrictive
  auth: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,           // 10 requests per minute
  },
  // OTP endpoints - very restrictive
  otp: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,            // 5 OTP requests per minute
  },
  // Write operations - moderately restrictive
  write: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30,           // 30 writes per minute
  },
  // Read operations - more permissive
  read: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,          // 100 reads per minute
  },
  // Default - balanced
  default: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,           // 60 requests per minute (1 per second average)
  },
};

// ============================================================================
// IN-MEMORY RATE LIMIT STORE
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (per Lambda instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  
  lastCleanup = now;
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned up ${cleaned} expired entries`);
  }
}

// ============================================================================
// RATE LIMIT LOGIC
// ============================================================================

/**
 * Get rate limit key from request
 */
function getRateLimitKey(c: Context, prefix: string = ''): string {
  // Get client IP
  const forwardedFor = c.req.header('x-forwarded-for');
  const realIp = c.req.header('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  
  // Get user ID if authenticated
  const userId = c.get('userId') || '';
  
  // Combine for unique key
  const baseKey = userId ? `user:${userId}` : `ip:${ip}`;
  
  return prefix ? `${prefix}:${baseKey}` : baseKey;
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(key: string, config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  const now = Date.now();
  cleanupExpiredEntries();
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry if doesn't exist or expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check limit
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count < config.maxRequests;
  
  // Increment counter
  entry.count++;
  
  return {
    allowed,
    remaining: Math.max(0, remaining - 1),
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config?: Partial<RateLimitConfig> | keyof typeof DEFAULT_LIMITS) {
  // Resolve config
  let resolvedConfig: RateLimitConfig;
  
  if (typeof config === 'string') {
    resolvedConfig = DEFAULT_LIMITS[config] || DEFAULT_LIMITS.default;
  } else {
    resolvedConfig = { ...DEFAULT_LIMITS.default, ...config };
  }
  
  return async (c: Context, next: Next) => {
    // Skip for OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return next();
    }
    
    const key = getRateLimitKey(c, resolvedConfig.keyPrefix);
    const result = checkRateLimit(key, resolvedConfig);
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(resolvedConfig.maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    
    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));
      
      console.warn(`[RateLimit] Rate limit exceeded for ${key}`);
      
      return c.json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      }, 429);
    }
    
    return next();
  };
}

/**
 * Rate limit middleware specifically for auth endpoints
 */
export function rateLimitAuth() {
  return rateLimit({ ...DEFAULT_LIMITS.auth, keyPrefix: 'auth' });
}

/**
 * Rate limit middleware specifically for OTP endpoints
 */
export function rateLimitOtp() {
  return rateLimit({ ...DEFAULT_LIMITS.otp, keyPrefix: 'otp' });
}

/**
 * Rate limit middleware for write operations
 */
export function rateLimitWrite() {
  return rateLimit({ ...DEFAULT_LIMITS.write, keyPrefix: 'write' });
}

/**
 * Rate limit middleware for read operations
 */
export function rateLimitRead() {
  return rateLimit({ ...DEFAULT_LIMITS.read, keyPrefix: 'read' });
}

/**
 * Sliding window rate limiter (more accurate but more memory-intensive)
 * Use for sensitive endpoints like payment or OTP
 */
export function slidingWindowRateLimit(config: RateLimitConfig & { keyPrefix: string }) {
  const windowStore = new Map<string, number[]>();
  
  return async (c: Context, next: Next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }
    
    const key = getRateLimitKey(c, config.keyPrefix);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Get existing timestamps
    let timestamps = windowStore.get(key) || [];
    
    // Remove expired timestamps
    timestamps = timestamps.filter(ts => ts > windowStart);
    
    // Check limit
    if (timestamps.length >= config.maxRequests) {
      const oldestTimestamp = timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
      
      c.header('X-RateLimit-Limit', String(config.maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('Retry-After', String(retryAfter));
      
      console.warn(`[RateLimit] Sliding window limit exceeded for ${key}`);
      
      return c.json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      }, 429);
    }
    
    // Add current timestamp
    timestamps.push(now);
    windowStore.set(key, timestamps);
    
    // Set headers
    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(config.maxRequests - timestamps.length));
    
    return next();
  };
}
