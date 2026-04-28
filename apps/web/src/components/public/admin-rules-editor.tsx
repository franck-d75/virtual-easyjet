"use client";

import type { ChangeEvent, JSX } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  AdminRulesPayload,
  RulesContentResponse,
  RulesSectionResponse,
} from "@/lib/api/types";

import {
  extractApiMessage,
  handleAdminUnauthorized,
  parseJsonPayload,
  type AdminFeedback,
} from "@/components/admin/admin-feedback";

type AdminRulesEditorProps = {
  initialRules: RulesContentResponse;
};

type EditableRuleSection = RulesSectionResponse & {
  bodyText: string;
};

function toEditableSections(
  sections: RulesSectionResponse[],
): EditableRuleSection[] {
  return sections.map((section) => ({
    ...section,
    bodyText: section.body.join("\n\n"),
  }));
}

function serializeRulesPayload(
  sections: EditableRuleSection[],
): AdminRulesPayload {
  return {
    sections: sections.map((section) => ({
      key: section.key,
      title: section.title.trim(),
      summary: section.summary.trim(),
      body: section.bodyText
        .split(/\n{2,}/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    })),
  };
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Jamais modifié";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AdminRulesEditor({
  initialRules,
}: AdminRulesEditorProps): JSX.Element {
  const [rules, setRules] = useState<RulesContentResponse>(initialRules);
  const [sections, setSections] = useState<EditableRuleSection[]>(
    toEditableSections(initialRules.sections),
  );
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateSection(
    index: number,
    field: "title" | "summary" | "bodyText",
    value: string,
  ): void {
    setSections((currentSections) =>
      currentSections.map((section, currentIndex) =>
        currentIndex === index
          ? {
              ...section,
              [field]: value,
            }
          : section,
      ),
    );
  }

  async function handleSubmit(): Promise<void> {
    setIsSubmitting(true);
    setFeedback(null);

    const response = await fetch("/api/admin/rules", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(serializeRulesPayload(sections)),
    });

    const rawPayload = await response.text();
    const payload = rawPayload ? parseJsonPayload(rawPayload) : null;

    setIsSubmitting(false);

    if (!response.ok) {
      if (handleAdminUnauthorized(response)) {
        return;
      }

      setFeedback({
        tone: "danger",
        message: extractApiMessage(
          payload,
          "Impossible d'enregistrer le règlement pour le moment.",
        ),
      });
      return;
    }

    const updatedRules = payload as RulesContentResponse;
    setRules(updatedRules);
    setSections(toEditableSections(updatedRules.sections));
    setFeedback({
      tone: "success",
      message: "Le règlement a été mis à jour avec succès.",
    });
  }

  return (
    <>
      <Card className="rules-editor-card">
        <div className="rules-editor-card__header">
          <div>
            <span className="section-eyebrow">Édition administrateur</span>
            <h2>Modifier les sections du règlement</h2>
            <p>
              Seuls les administrateurs peuvent modifier le comportement,
              l&apos;exploitation, l&apos;activité et les sanctions.
            </p>
          </div>
          <div className="rules-editor-card__meta">
            <span>Dernière mise à jour</span>
            <strong>{formatUpdatedAt(rules.updatedAt)}</strong>
            <small>
              {rules.updatedBy
                ? `par ${rules.updatedBy.username}`
                : "Version par défaut"}
            </small>
          </div>
        </div>

        <div className="rules-editor-grid">
          {sections.map((section, index) => (
            <article className="rules-editor-section" key={section.key}>
              <span className="section-eyebrow">{section.title}</span>
              <div className="field">
                <label htmlFor={`rule-title-${section.key}`}>Titre</label>
                <input
                  id={`rule-title-${section.key}`}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateSection(index, "title", event.target.value)
                  }
                  value={section.title}
                />
              </div>
              <div className="field">
                <label htmlFor={`rule-summary-${section.key}`}>Résumé</label>
                <textarea
                  id={`rule-summary-${section.key}`}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    updateSection(index, "summary", event.target.value)
                  }
                  rows={3}
                  value={section.summary}
                />
              </div>
              <div className="field">
                <label htmlFor={`rule-body-${section.key}`}>
                  Contenu
                </label>
                <textarea
                  id={`rule-body-${section.key}`}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    updateSection(index, "bodyText", event.target.value)
                  }
                  rows={7}
                  value={section.bodyText}
                />
                <small className="rules-editor-help">
                  Sépare les paragraphes avec une ligne vide.
                </small>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-page-actions">
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer le règlement"}
          </Button>
        </div>

        {feedback ? (
          <p
            className={`inline-feedback inline-feedback--${feedback.tone}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
      </Card>

      <section className="rules-grid">
        {rules.sections.map((section) => (
          <Card className="rules-card" key={section.key}>
            <h2>{section.title}</h2>
            <p className="rules-card__summary">{section.summary}</p>
            <div className="rules-card__body">
              {section.body.map((paragraph) => (
                <p key={`${section.key}-${paragraph.slice(0, 32)}`}>{paragraph}</p>
              ))}
            </div>
          </Card>
        ))}
      </section>
    </>
  );
}
