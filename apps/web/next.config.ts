import type { NextConfig } from "next";

function toOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const connectSources = new Set<string>([
    "'self'",
    "https:",
    "wss:",
  ]);
  const apiOrigins = [
    toOrigin(process.env.NEXT_PUBLIC_API_URL),
    toOrigin(process.env.NEXT_PUBLIC_API_BASE_URL),
    toOrigin(process.env.WEB_API_BASE_URL),
  ].filter((value): value is string => value !== null);

  for (const origin of apiOrigins) {
    connectSources.add(origin);
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    isDevelopment ? "" : "upgrade-insecure-requests",
  ]
    .filter((directive) => directive.length > 0)
    .join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
