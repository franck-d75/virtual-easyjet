export const PUBLIC_RULES_SETTING_KEY = "public_rules_content";

export const RULE_SECTION_KEYS = [
  "behavior",
  "operations",
  "activity",
  "sanctions",
] as const;

export type RuleSectionKey = (typeof RULE_SECTION_KEYS)[number];

export interface RuleSectionContent {
  key: RuleSectionKey;
  title: string;
  summary: string;
  body: string[];
}

export interface RulesContent {
  sections: RuleSectionContent[];
}

const DEFAULT_RULES_SECTIONS: RuleSectionContent[] = [
  {
    key: "behavior",
    title: "Comportement",
    summary: "Une ambiance sérieuse, respectueuse et agréable pour tous les pilotes.",
    body: [
      "Chaque pilote doit adopter une attitude respectueuse envers les autres membres, le staff et l'ensemble de l'environnement de simulation.",
      "Les échanges doivent rester cordiaux, constructifs et conformes à l'esprit de la compagnie virtuelle.",
    ],
  },
  {
    key: "operations",
    title: "Exploitation",
    summary: "Des vols cohérents avec la flotte, la route, l'appareil et les outils de suivi de la VA.",
    body: [
      "Les réservations doivent être exploitées de manière cohérente avec l'appareil assigné, la route prévue et les procédures opérationnelles applicables.",
      "L'utilisation du suivi ACARS, du plan SimBrief et des données de vol réelles fait partie du cadre standard d'exploitation.",
    ],
  },
  {
    key: "activity",
    title: "Activité",
    summary: "Une activité régulière permet de garder un réseau vivant, lisible et crédible.",
    body: [
      "Une présence régulière est encouragée afin de maintenir une compagnie active et agréable à suivre pour tous les pilotes.",
      "Les périodes d'absence ne sont pas sanctionnées automatiquement, mais une activité sincère et suivie reste l'objectif recherché.",
    ],
  },
  {
    key: "sanctions",
    title: "Sanctions",
    summary: "Le staff peut intervenir de manière progressive si le règlement n'est pas respecté.",
    body: [
      "En cas de non-respect répété du règlement, le staff peut appliquer des mesures proportionnées à la gravité de la situation.",
      "Ces mesures peuvent aller d'un rappel simple jusqu'à une restriction ou une suspension d'accès si nécessaire.",
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeBody(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const paragraphs = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  return paragraphs.length > 0 ? paragraphs : fallback;
}

export function getDefaultRulesContent(): RulesContent {
  return {
    sections: DEFAULT_RULES_SECTIONS.map((section) => ({
      ...section,
      body: [...section.body],
    })),
  };
}

export function normalizeRulesContent(value: unknown): RulesContent {
  const sourceSections =
    isRecord(value) && Array.isArray(value.sections) ? value.sections : [];
  const sectionMap = new Map<RuleSectionKey, Record<string, unknown>>();

  for (const section of sourceSections) {
    if (!isRecord(section)) {
      continue;
    }

    const key = section.key;

    if (typeof key !== "string" || !RULE_SECTION_KEYS.includes(key as RuleSectionKey)) {
      continue;
    }

    sectionMap.set(key as RuleSectionKey, section);
  }

  return {
    sections: DEFAULT_RULES_SECTIONS.map((fallbackSection) => {
      const source = sectionMap.get(fallbackSection.key);

      return {
        key: fallbackSection.key,
        title: normalizeText(source?.title, fallbackSection.title),
        summary: normalizeText(source?.summary, fallbackSection.summary),
        body: normalizeBody(source?.body, fallbackSection.body),
      };
    }),
  };
}
