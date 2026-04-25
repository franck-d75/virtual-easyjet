import {
  CanActivate,
  Dependencies,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type HttpExceptionBody,
} from "@nestjs/common";

import {
  getRequestActorKey,
  getRequestClientIp,
} from "./request-client.utils.js";
import { RateLimitService, type RateLimitPolicy } from "./rate-limit.service.js";

type RequestLike = {
  method?: string;
  originalUrl?: string;
  user?: {
    id?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string | null;
  };
};

type ResponseLike = {
  setHeader?: (name: string, value: string | number) => void;
};

const ACARS_RATE_LIMIT_POLICIES = {
  sessionCreate: {
    name: "acars.session.create",
    limit: 30,
    windowMs: 10 * 60_000,
  },
  telemetry: {
    name: "acars.telemetry",
    limit: 1_200,
    windowMs: 60_000,
  },
  sessionComplete: {
    name: "acars.session.complete",
    limit: 30,
    windowMs: 10 * 60_000,
  },
  publicGet: {
    name: "acars.public.get",
    limit: 300,
    windowMs: 5 * 60_000,
  },
} satisfies Record<string, RateLimitPolicy>;

function getRequestPath(request: RequestLike): string {
  return (request.originalUrl ?? "/").split("?")[0] ?? "/";
}

function extractSessionId(path: string): string | null {
  const match = /^\/acars\/sessions\/([^/]+)/.exec(path);
  return match?.[1] ?? null;
}

function resolvePolicy(
  request: RequestLike,
): { policy: RateLimitPolicy; key: string } | null {
  const method = request.method?.toUpperCase() ?? "GET";
  const path = getRequestPath(request);

  if (method === "POST" && path === "/acars/sessions") {
    return {
      policy: ACARS_RATE_LIMIT_POLICIES.sessionCreate,
      key: `${ACARS_RATE_LIMIT_POLICIES.sessionCreate.name}:${getRequestActorKey(request)}`,
    };
  }

  if (method === "POST" && /\/acars\/sessions\/[^/]+\/telemetry$/.test(path)) {
    const sessionId = extractSessionId(path) ?? "unknown";
    return {
      policy: ACARS_RATE_LIMIT_POLICIES.telemetry,
      key: `${ACARS_RATE_LIMIT_POLICIES.telemetry.name}:${getRequestActorKey(request)}:${sessionId}`,
    };
  }

  if (method === "POST" && /\/acars\/sessions\/[^/]+\/complete$/.test(path)) {
    const sessionId = extractSessionId(path) ?? "unknown";
    return {
      policy: ACARS_RATE_LIMIT_POLICIES.sessionComplete,
      key: `${ACARS_RATE_LIMIT_POLICIES.sessionComplete.name}:${getRequestActorKey(request)}:${sessionId}`,
    };
  }

  if (method === "GET" && path === "/acars/health") {
    return {
      policy: ACARS_RATE_LIMIT_POLICIES.publicGet,
      key: `${ACARS_RATE_LIMIT_POLICIES.publicGet.name}:${getRequestClientIp(request)}`,
    };
  }

  return null;
}

@Injectable()
@Dependencies(RateLimitService)
export class RateLimitGuard implements CanActivate {
  public constructor(private readonly rateLimitService: RateLimitService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const response = context.switchToHttp().getResponse<ResponseLike>();
    const resolved = resolvePolicy(request);

    if (!resolved) {
      return true;
    }

    const result = this.rateLimitService.consume(resolved.key, resolved.policy);

    response.setHeader?.("X-RateLimit-Limit", result.limit);
    response.setHeader?.("X-RateLimit-Remaining", result.remaining);
    response.setHeader?.(
      "X-RateLimit-Reset",
      new Date(result.resetAt).toISOString(),
    );

    if (result.allowed) {
      return true;
    }

    response.setHeader?.("Retry-After", result.retryAfterSeconds);

    const body: HttpExceptionBody = {
      statusCode: 429,
      message:
        "Trop de requêtes ACARS ont été reçues. Réessayez dans quelques instants.",
      error: "Too Many Requests",
    };

    throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
