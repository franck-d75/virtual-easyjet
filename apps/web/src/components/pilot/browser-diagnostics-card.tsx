"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  clearBrowserDiagnostics,
  exportBrowserDiagnostics,
  readBrowserDiagnostics,
} from "@/lib/diagnostics/browser-journal";

export function BrowserDiagnosticsCard(): JSX.Element {
  const [refreshToken, setRefreshToken] = useState(0);
  const entries = useMemo(() => readBrowserDiagnostics(), [refreshToken]);
  const latestEntry = entries[0] ?? null;

  return (
    <Card className="ops-card">
      <span className="section-eyebrow">Diagnostic local</span>
      <h2>Journal navigateur exportable</h2>
      <p>
        Le site enregistre localement les pages vues, requêtes, erreurs et
        changements réseau dans votre navigateur. Vous pouvez exporter ce
        journal au format JSON pour faciliter les futurs diagnostics.
      </p>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__label">Entrées</span>
          <strong className="stat-card__value">{entries.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Dernière activité</span>
          <strong className="stat-card__value">
            {latestEntry ? new Date(latestEntry.at).toLocaleString("fr-FR") : "Aucune"}
          </strong>
        </div>
      </div>
      <div className="inline-actions">
        <Button
          onClick={() => {
            exportBrowserDiagnostics();
            setRefreshToken((currentValue) => currentValue + 1);
          }}
        >
          Exporter le journal navigateur
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            clearBrowserDiagnostics();
            setRefreshToken((currentValue) => currentValue + 1);
          }}
        >
          Réinitialiser le journal
        </Button>
      </div>
      {latestEntry ? (
        <p className="form-hint">
          Dernier événement : <strong>{latestEntry.event}</strong>
        </p>
      ) : null}
    </Card>
  );
}
