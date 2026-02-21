type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type GlobalRateLimitStore = {
  __rateLimitStore?: Map<string, RateLimitBucket>;
};

const globalStore = globalThis as unknown as GlobalRateLimitStore;
const store = globalStore.__rateLimitStore ?? new Map<string, RateLimitBucket>();

if (process.env.NODE_ENV !== "production") {
  globalStore.__rateLimitStore = store;
}

type ConsumeRateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export type ConsumeRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

function maybePrune(now: number) {
  if (store.size < 5000) return;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function consumeRateLimit({
  key,
  limit,
  windowMs,
}: ConsumeRateLimitInput): ConsumeRateLimitResult {
  const now = Date.now();
  maybePrune(now);

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: 0,
  };
}

export function getClientIp(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  return "unknown";
}
