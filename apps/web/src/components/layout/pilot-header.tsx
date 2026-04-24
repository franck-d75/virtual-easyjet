"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandBadge } from "@/components/layout/brand-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { APP_NAME } from "@/lib/config/env";
import { cn } from "@/lib/utils/cn";

const pilotLinks = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/profil", label: "Profil" },
  { href: "/bookings", label: "Réservations" },
  { href: "/vols", label: "Vols" },
  { href: "/live-map", label: "Carte en direct" },
  { href: "/pireps", label: "PIREPs" },
];

type PilotHeaderProps = {
  pilotName: string;
  pilotNumber: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
};

export function PilotHeader({
  pilotName,
  pilotNumber,
  avatarUrl = null,
  isAdmin = false,
}: PilotHeaderProps): JSX.Element {
  const pathname = usePathname();
  const navigationLinks = isAdmin
    ? [...pilotLinks, { href: "/admin", label: "Administration" }]
    : pilotLinks;

  return (
    <header className="site-header">
      <div className="page-shell page-shell--wide site-header__inner">
        <Link className="brand-mark" href="/dashboard">
          <BrandBadge />
          <span className="brand-mark__text">
            <strong>{APP_NAME}</strong>
            <small>Espace pilote</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navigation pilote">
          {navigationLinks.map((link) => (
            <Link
              className={cn(
                "site-nav__link",
                pathname.startsWith(link.href) && "site-nav__link--active",
              )}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="pilot-chip">
          <div className="pilot-chip__identity">
            <UserAvatar avatarUrl={avatarUrl} name={pilotName} size="sm" />
            <div>
              <strong>{pilotName}</strong>
              <small>{pilotNumber}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
