"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandBadge } from "@/components/layout/brand-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { APP_NAME } from "@/lib/config/env";
import type { BookingResponse, UserMeResponse } from "@/lib/api/types";
import { isActiveBooking } from "@/lib/utils/booking-opportunities";
import { cn } from "@/lib/utils/cn";

const publicLinks = [
  { href: "/", label: "Accueil" },
  { href: "/compagnie", label: "Compagnie" },
  { href: "/flotte", label: "Flotte" },
  { href: "/hubs", label: "Hubs" },
  { href: "/routes", label: "Routes" },
  { href: "/live-map", label: "Carte en direct" },
  { href: "/acars", label: "ACARS" },
  { href: "/recrutement", label: "Recrutement" },
  { href: "/reglement", label: "Règlement" },
];

type SessionState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | {
      status: "authenticated";
      user: UserMeResponse;
      hasActiveBooking: boolean;
    };

function getDisplayName(user: UserMeResponse): string {
  if (user.pilotProfile) {
    const firstName = user.pilotProfile.firstName.trim();
    const lastName = user.pilotProfile.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName.length > 0) {
      return fullName;
    }
  }

  return user.username;
}

function getSecondaryLabel(user: UserMeResponse): string {
  const pilotNumber = user.pilotProfile?.pilotNumber?.trim() ?? null;

  if (user.role === "ADMIN") {
    return pilotNumber
      ? `Accès administrateur · ${pilotNumber}`
      : "Accès administrateur";
  }

  if (pilotNumber) {
    return `Compte pilote · ${pilotNumber}`;
  }

  return "Compte pilote";
}

function hasActiveReservation(bookings: BookingResponse[]): boolean {
  return bookings.some(isActiveBooking);
}

export function PublicHeader(): JSX.Element {
  const pathname = usePathname();
  const isLiveMap = pathname.startsWith("/live-map");
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    let active = true;

    async function loadSession(): Promise<void> {
      try {
        const response = await fetch("/api/session/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!active) {
          return;
        }

        if (!response.ok) {
          setSessionState({
            status: "guest",
            user: null,
          });
          return;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          user?: UserMeResponse;
        };

        if (payload.authenticated && payload.user) {
          let hasActiveBooking = false;

          if (payload.user.pilotProfile) {
            try {
              const bookingsResponse = await fetch("/api/pilot/bookings", {
                method: "GET",
                cache: "no-store",
                credentials: "include",
              });

              if (bookingsResponse.ok) {
                const bookings =
                  (await bookingsResponse.json()) as BookingResponse[];
                hasActiveBooking = hasActiveReservation(bookings);
              }
            } catch {
              hasActiveBooking = false;
            }
          }

          if (!active) {
            return;
          }

          setSessionState({
            status: "authenticated",
            user: payload.user,
            hasActiveBooking,
          });
          return;
        }

        setSessionState({
          status: "guest",
          user: null,
        });
      } catch {
        if (!active) {
          return;
        }

        setSessionState({
          status: "guest",
          user: null,
        });
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  const navigationLinks =
    sessionState.status === "authenticated" && sessionState.hasActiveBooking
      ? [
          ...publicLinks.slice(0, 5),
          { href: "/reservation", label: "Réservation" },
          ...publicLinks.slice(5),
        ]
      : publicLinks;

  return (
    <header className={cn("site-header", isLiveMap && "site-header--compact")}>
      <div
        className={cn(
          "page-shell page-shell--wide site-header__inner",
          isLiveMap && "site-header__inner--compact",
        )}
      >
        <Link className="brand-mark" href="/" prefetch={false}>
          <BrandBadge />
          <span className="brand-mark__text">
            <strong>{APP_NAME}</strong>
            <small>{isLiveMap ? "Suivi ACARS" : "Compagnie aérienne virtuelle"}</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navigation publique">
          {navigationLinks.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                className={cn("site-nav__link", isActive && "site-nav__link--active")}
                href={link.href}
                key={link.href}
                prefetch={false}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {sessionState.status === "authenticated" ? (
          <div className="pilot-chip">
            <div className="pilot-chip__identity">
              <div className="pilot-chip__avatar">
                <UserAvatar
                  avatarUrl={sessionState.user.avatarUrl}
                  name={getDisplayName(sessionState.user)}
                  size="sm"
                />
              </div>
              <div className="pilot-chip__copy">
                <span className="pilot-chip__eyebrow">
                  {isLiveMap ? "Suivi en direct" : "Bienvenue à bord"}
                </span>
                <strong>{getDisplayName(sessionState.user)}</strong>
                <small>{getSecondaryLabel(sessionState.user)}</small>
              </div>
            </div>
            <div className="pilot-chip__actions">
              <Link
                className={cn(
                  "site-header__login",
                  isLiveMap && "site-header__login--compact",
                )}
                href={sessionState.user.role === "ADMIN" ? "/admin" : "/dashboard"}
                prefetch={false}
              >
                {sessionState.user.role === "ADMIN" ? "Administration" : "Dashboard"}
              </Link>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <Link
            className={cn("site-header__login", isLiveMap && "site-header__login--compact")}
            href="/connexion"
            prefetch={false}
          >
            {sessionState.status === "loading" ? "Connexion..." : "Se connecter"}
          </Link>
        )}
      </div>
    </header>
  );
}
