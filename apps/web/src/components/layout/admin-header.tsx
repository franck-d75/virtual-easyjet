"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandBadge } from "@/components/layout/brand-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { APP_NAME } from "@/lib/config/env";
import { cn } from "@/lib/utils/cn";

const adminLinks = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/pireps", label: "Rapports de vol" },
  { href: "/admin/flotte", label: "Flotte" },
  { href: "/admin/hubs", label: "Hubs" },
  { href: "/admin/routes", label: "Routes" },
  { href: "/admin/reglement", label: "Règlement" },
  { href: "/acars", label: "ACARS" },
  { href: "/live-map", label: "Carte en direct" },
  { href: "/dashboard", label: "Espace pilote" },
];

type AdminHeaderProps = {
  adminName: string;
  avatarUrl?: string | null;
};

export function AdminHeader({
  adminName,
  avatarUrl = null,
}: AdminHeaderProps): JSX.Element {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="page-shell page-shell--wide site-header__inner">
        <Link className="brand-mark" href="/admin">
          <BrandBadge />
          <span className="brand-mark__text">
            <strong>{APP_NAME}</strong>
            <small>Administration</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navigation administration">
          {adminLinks.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);

            return (
              <Link
                className={cn("site-nav__link", isActive && "site-nav__link--active")}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="pilot-chip">
          <div className="pilot-chip__identity">
            <div className="pilot-chip__avatar">
              <UserAvatar avatarUrl={avatarUrl} name={adminName} size="sm" />
            </div>
            <div className="pilot-chip__copy">
              <span className="pilot-chip__eyebrow">Console d&apos;administration</span>
              <strong>{adminName}</strong>
              <small>Accès administrateur</small>
            </div>
          </div>
          <div className="pilot-chip__actions">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
