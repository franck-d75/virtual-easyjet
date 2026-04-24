"use client";

import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type RegisterFormState = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: string;
};

const INITIAL_STATE: RegisterFormState = {
  email: "",
  username: "",
  password: "",
  firstName: "",
  lastName: "",
  countryCode: "",
};

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [formState, setFormState] = useState<RegisterFormState>(INITIAL_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<Key extends keyof RegisterFormState>(
    key: Key,
    value: RegisterFormState[Key],
  ): void {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/session/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Inscription impossible.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Inscription impossible.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="register-email">Adresse e-mail</label>
        <input
          autoComplete="email"
          id="register-email"
          onChange={(event) => updateField("email", event.target.value)}
          placeholder="pilot@example.com"
          required
          type="email"
          value={formState.email}
        />
      </div>

      <div className="field">
        <label htmlFor="register-username">Nom d’utilisateur</label>
        <input
          autoComplete="username"
          id="register-username"
          onChange={(event) => updateField("username", event.target.value)}
          placeholder="monpilot"
          required
          type="text"
          value={formState.username}
        />
      </div>

      <div className="field-group">
        <div className="field">
          <label htmlFor="register-first-name">Prénom</label>
          <input
            autoComplete="given-name"
            id="register-first-name"
            onChange={(event) => updateField("firstName", event.target.value)}
            placeholder="Prénom"
            required
            type="text"
            value={formState.firstName}
          />
        </div>
        <div className="field">
          <label htmlFor="register-last-name">Nom</label>
          <input
            autoComplete="family-name"
            id="register-last-name"
            onChange={(event) => updateField("lastName", event.target.value)}
            placeholder="Nom"
            required
            type="text"
            value={formState.lastName}
          />
        </div>
      </div>

      <div className="field-group">
        <div className="field">
          <label htmlFor="register-country">Pays (code ISO)</label>
          <input
            autoComplete="country"
            id="register-country"
            maxLength={2}
            onChange={(event) =>
              updateField("countryCode", event.target.value.toUpperCase())
            }
            placeholder="FR"
            type="text"
            value={formState.countryCode}
          />
        </div>
        <div className="field">
          <label htmlFor="register-password">Mot de passe</label>
          <input
            autoComplete="new-password"
            id="register-password"
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="8 caractères minimum"
            required
            type="password"
            value={formState.password}
          />
        </div>
      </div>

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Création..." : "Créer un compte"}
      </Button>
    </form>
  );
}
