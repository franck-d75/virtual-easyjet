import type { JSX } from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage(): Promise<JSX.Element> {
  const session = await getServerSession();

  if (session?.user.pilotProfile) {
    redirect("/dashboard");
  }

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Connexion</span>
        <h1>Connexion pilote</h1>
        <p>
          Accédez à votre espace pilote pour consulter vos réservations, suivre
          vos vols, lancer l’ACARS et gérer vos PIREPs.
        </p>
      </section>

      <div className="two-column">
        <Card className="auth-card" id="create-account">
          <h2>Se connecter</h2>
          <p>
            Utilisez vos identifiants pilote pour accéder au tableau de bord et
            aux données opérationnelles réelles de la compagnie.
          </p>
          <LoginForm />
        </Card>

        <Card className="auth-card">
          <h2>Créer un compte</h2>
          <p>
            Rejoignez la compagnie avec un compte pilote relié à la plateforme
            de production, prêt pour les réservations, SimBrief et l’ACARS.
          </p>
          <RegisterForm />
        </Card>
      </div>
    </>
  );
}
