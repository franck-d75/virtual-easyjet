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
          <Link href="/">Accueil</Link>
          <Link href="/compagnie">Compagnie</Link>
          <Link href="/flotte">Flotte</Link>
          <Link href="/hubs">Hubs</Link>
          <Link href="/routes">Routes</Link>
          <Link href="/acars">ACARS</Link>
          <Link href="/connexion">Connexion</Link>
        </nav>
      </div>
    </footer>
  );
}
