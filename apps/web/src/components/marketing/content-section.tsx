import type { JSX, ReactNode } from "react";

import { Card } from "@/components/ui/card";

type ContentSectionProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
};

export function ContentSection({
  eyebrow,
  title,
  children,
}: ContentSectionProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-heading">
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      <Card>{children}</Card>
    </section>
  );
}
