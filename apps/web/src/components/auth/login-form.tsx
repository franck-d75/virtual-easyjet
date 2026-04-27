"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({
  redirectTo = "/dashboard",
}: LoginFormProps): JSX.Element {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Connexion impossible.");
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="identifier">Adresse e-mail ou nom d’utilisateur</label>
        <input
          autoComplete="username"
          id="identifier"
          name="identifier"
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="pilotdemo ou pilot@va.local"
          required
          type="text"
          value={identifier}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Votre mot de passe"
          required
          type="password"
          value={password}
        />
      </div>

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </Button>
    </form>
  );
}
