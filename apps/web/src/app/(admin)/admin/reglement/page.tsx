import type { JSX } from "react";

import { AdminRulesEditor } from "@/components/public/admin-rules-editor";
import { Card } from "@/components/ui/card";
import { getAdminRules } from "@/lib/api/admin";
import { getPublicRules } from "@/lib/api/public";
import type { RulesContentResponse } from "@/lib/api/types";
import {
  handleProtectedPageApiError,
  requireAdminSession,
} from "@/lib/auth/guards";
import { logWebWarning } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

const EMPTY_RULES: RulesContentResponse = {
  sections: [],
  updatedAt: null,
  updatedBy: null,
};

export default async function AdminRulesPage(): Promise<JSX.Element> {
  const session = await requireAdminSession();
  let rules = EMPTY_RULES;
  let isDegraded = false;

  try {
    rules = await getAdminRules(session.accessToken);
  } catch (error) {
    handleProtectedPageApiError(error);
    isDegraded = true;
    logWebWarning("admin rules fetch failed", error);
    rules = await getPublicRules();
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <span className="section-eyebrow">Administration règlement</span>
          <h1>Édition du règlement</h1>
          <p>
            Modifiez les sections visibles par les pilotes depuis la page
            publique du règlement.
          </p>
        </div>
      </section>

      {isDegraded ? (
        <Card className="ops-card">
          <span className="section-eyebrow">Mode degrade</span>
          <h2>Le règlement reste consultable</h2>
          <p>
            La version administrateur n&apos;a pas pu etre rechargee. La version
            publique est affichée en lecture de secours.
          </p>
        </Card>
      ) : null}

      <AdminRulesEditor initialRules={rules} />
    </div>
  );
}
