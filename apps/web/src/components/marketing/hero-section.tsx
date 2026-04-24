import type { JSX, ReactNode } from "react";

import { Card } from "@/components/ui/card";

type HeroSectionProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  aside?: ReactNode;
};

export function HeroSection({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
}: HeroSectionProps): JSX.Element {
  return (
    <section className="hero">
      <Card className="hero__copy">
        <span className="section-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="hero__subtitle">{subtitle}</p>
        {actions ? <div className="hero__actions">{actions}</div> : null}
      </Card>
      {aside ? <Card className="hero__aside">{aside}</Card> : null}
    </section>
  );
}
