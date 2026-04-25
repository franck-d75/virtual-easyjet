type CorsCallback = (error: Error | null, allow?: boolean) => void;

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
};

type RequestLike = {
  originalUrl?: string;
};

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function createCorsOriginHandler(
  corsOriginValue: string,
  nodeEnv: "development" | "test" | "production",
) {
  const allowedOrigins = parseCorsOrigins(corsOriginValue);

  if (nodeEnv === "production" && allowedOrigins.includes("*")) {
    throw new Error("CORS_ORIGIN cannot contain '*' in production.");
  }

  return (origin: string | undefined, callback: CorsCallback): void => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (nodeEnv !== "production" && isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };
}

export function applyHttpSecurityHeaders(
  request: RequestLike,
  response: ResponseLike,
): void {
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const path = request.originalUrl ?? "/";

  if (!path.startsWith("/docs")) {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
  }
}
