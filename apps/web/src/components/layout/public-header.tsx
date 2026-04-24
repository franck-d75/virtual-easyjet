"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandBadge } from "@/components/layout/brand-badge";
import { APP_NAME } from "@/lib/config/env";
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

export function PublicHeader(): JSX.Element {
  const pathname = usePathname();
  const isLiveMap = pathname.startsWith("/live-map");

  return (
    <header className={cn("site-header", isLiveMap && "site-header--compact")}>
      <div
        className={cn(
          "page-shell page-shell--wide site-header__inner",
          isLiveMap && "site-header__inner--compact",
        )}
      >
        <Link className="brand-mark" href="/">
          <BrandBadge />
          <span className="brand-mark__text">
            <strong>{APP_NAME}</strong>
            <small>{isLiveMap ? "Suivi ACARS" : "Compagnie aérienne virtuelle"}</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Navigation publique">
          {publicLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
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

        <Link
          className={cn("site-header__login", isLiveMap && "site-header__login--compact")}
          href="/connexion"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}
