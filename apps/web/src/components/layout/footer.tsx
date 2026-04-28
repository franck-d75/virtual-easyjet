import type { JSX } from "react";
import Link from "next/link";

import { APP_NAME, UNOFFICIAL_DISCLAIMER } from "@/lib/config/env";

export function Footer(): JSX.Element {
  return (
    <footer className="site-footer">
      <div className="page-shell page-shell--wide site-footer__inner">
        <div>
          <strong>{APP_NAME}</strong>
          <p>
            Une compagnie aérienne virtuelle moderne, orientée opérations,
            ACARS et régularité pilote.
          </p>
          <small className="site-footer__legal">{UNOFFICIAL_DISCLAIMER}</small>
        </div>
        <nav className="site-footer__links" aria-label="Liens de pied de page">
          <Link href="/" prefetch={false}>
            Accueil
          </Link>
          <Link href="/compagnie" prefetch={false}>
            Compagnie
          </Link>
          <Link href="/flotte" prefetch={false}>
            Flotte
          </Link>
          <Link href="/hubs" prefetch={false}>
            Hubs
          </Link>
          <Link href="/routes" prefetch={false}>
            Routes
          </Link>
          <Link href="/acars" prefetch={false}>
            ACARS
          </Link>
          <Link href="/connexion" prefetch={false}>
            Connexion
          </Link>
        </nav>
      </div>
    </footer>
  );
}
