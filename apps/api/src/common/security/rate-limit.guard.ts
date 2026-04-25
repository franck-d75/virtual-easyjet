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

const API_RATE_LIMIT_POLICIES = {
  publicGet: {
    name: "public.get",
    limit: 300,
    windowMs: 5 * 60_000,
  },
  login: {
    name: "auth.login",
    limit: 10,
    windowMs: 10 * 60_000,
  },
  register: {
    name: "auth.register",
    limit: 5,
    windowMs: 60 * 60_000,
  },
  avatarUpload: {
    name: "users.avatar",
    limit: 10,
    windowMs: 60 * 60_000,
  },
  adminWrite: {
    name: "admin.write",
    limit: 60,
    windowMs: 15 * 60_000,
  },
} satisfies Record<string, RateLimitPolicy>;

function getRequestPath(request: RequestLike): string {
  return (request.originalUrl ?? "/").split("?")[0] ?? "/";
}

function isPublicGetRoute(path: string): boolean {
  return (
    path === "/api/public/home" ||
    path === "/api/public/stats" ||
    path === "/api/health" ||
    path === "/api/acars/live" ||
    path === "/api/aircraft" ||
    path === "/api/hubs" ||
    path === "/api/routes" ||
    path === "/api/ranks"
  );
}

function resolvePolicy(
  request: RequestLike,
): { policy: RateLimitPolicy; key: string } | null {
  const method = request.method?.toUpperCase() ?? "GET";
  const path = getRequestPath(request);

  if (method === "POST" && path === "/api/auth/login") {
    const ip = getRequestClientIp(request);
    return {
      policy: API_RATE_LIMIT_POLICIES.login,
      key: `${API_RATE_LIMIT_POLICIES.login.name}:${ip}`,
    };
  }

  if (method === "POST" && path === "/api/auth/register") {
    const ip = getRequestClientIp(request);
    return {
      policy: API_RATE_LIMIT_POLICIES.register,
      key: `${API_RATE_LIMIT_POLICIES.register.name}:${ip}`,
    };
  }

  if (method === "POST" && path === "/api/users/me/avatar") {
    return {
      policy: API_RATE_LIMIT_POLICIES.avatarUpload,
      key: `${API_RATE_LIMIT_POLICIES.avatarUpload.name}:${getRequestActorKey(request)}`,
    };
  }

  if (
    path.startsWith("/api/admin/") &&
    ["POST", "PATCH", "DELETE"].includes(method)
  ) {
    return {
      policy: API_RATE_LIMIT_POLICIES.adminWrite,
      key: `${API_RATE_LIMIT_POLICIES.adminWrite.name}:${getRequestActorKey(request)}`,
    };
  }

  if (method === "GET" && isPublicGetRoute(path)) {
    const ip = getRequestClientIp(request);
    return {
      policy: API_RATE_LIMIT_POLICIES.publicGet,
      key: `${API_RATE_LIMIT_POLICIES.publicGet.name}:${ip}`,
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
        "Trop de requêtes pour cette opération. Réessayez dans quelques instants.",
      error: "Too Many Requests",
    };

    throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
