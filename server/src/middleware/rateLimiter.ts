import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory bucket for login & OTP brute-force protection
const requestBuckets = new Map<string, RateLimitRecord>();

export function rateLimiter(options: { windowMs: number; maxRequests: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = requestBuckets.get(key);

    if (!record || now > record.resetAt) {
      requestBuckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      return next();
    }

    if (record.count >= options.maxRequests) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        error: options.message || `Too many attempts. Please try again in ${waitSeconds} seconds.`
      });
    }

    record.count += 1;
    next();
  };
}
