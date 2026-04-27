import type { AuthSession } from "@va/shared";
import type { NextResponse } from "next/server";

import { getAppBaseUrl, isProductionEnvironment } from "../config/env";

export const ACCESS_COOKIE_NAME = "vej_access_token";
export const REFRESH_COOKIE_NAME = "vej_refresh_token";

function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amountLiteral = match[1];
  const unitLiteral = match[2];

  if (!amountLiteral || !unitLiteral) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number.parseInt(amountLiteral, 10);
  const unit = unitLiteral.toLowerCase();

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 3_600;
    case "d":
      return amount * 86_400;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

function getCookieOptions(maxAge: number) {
  const isProduction = isProductionEnvironment();

  return {
    domain: getCookieDomain(),
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    secure: isProduction,
  };
}

function getCookieDomain(): string | undefined {
  if (!isProductionEnvironment()) {
    return undefined;
  }

  try {
    const hostname = new URL(getAppBaseUrl()).hostname.toLowerCase();

    if (
      hostname === "virtual-easyjet.fr" ||
      hostname === "www.virtual-easyjet.fr" ||
      hostname.endsWith(".virtual-easyjet.fr")
    ) {
      return ".virtual-easyjet.fr";
    }

    if (
      hostname === "localhost" ||
      hostname.endsWith(".vercel.app") ||
      !hostname.includes(".")
    ) {
      return undefined;
    }

    return hostname.startsWith("www.") ? `.${hostname.slice(4)}` : `.${hostname}`;
  } catch {
    return ".virtual-easyjet.fr";
  }
}

export function applySessionCookies(
  response: NextResponse,
  session: AuthSession,
): void {
  response.cookies.set(
    ACCESS_COOKIE_NAME,
    session.tokens.accessToken,
    getCookieOptions(durationToSeconds(session.tokens.accessTokenExpiresIn)),
  );
  response.cookies.set(
    REFRESH_COOKIE_NAME,
    session.tokens.refreshToken,
    getCookieOptions(durationToSeconds(session.tokens.refreshTokenExpiresIn)),
  );
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE_NAME, "", getCookieOptions(0));
  response.cookies.set(REFRESH_COOKIE_NAME, "", getCookieOptions(0));
}
