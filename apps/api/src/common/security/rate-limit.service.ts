import { Injectable } from "@nestjs/common";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  hits: number[];
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public consume(key: string, policy: RateLimitPolicy): RateLimitResult {
    const now = Date.now();
    const windowStart = now - policy.windowMs;
    const bucket = this.buckets.get(key) ?? { hits: [] };
    const activeHits = bucket.hits.filter((timestamp) => timestamp > windowStart);

    if (activeHits.length >= policy.limit) {
      const oldestActiveHit = activeHits[0] ?? now;
      const retryAfterSeconds = Math.max(
        Math.ceil((oldestActiveHit + policy.windowMs - now) / 1_000),
        1,
      );

      this.buckets.set(key, { hits: activeHits });

      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSeconds,
        resetAt: oldestActiveHit + policy.windowMs,
      };
    }

    activeHits.push(now);
    this.buckets.set(key, { hits: activeHits });

    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(policy.limit - activeHits.length, 0),
      retryAfterSeconds: 0,
      resetAt: now + policy.windowMs,
    };
  }
}
