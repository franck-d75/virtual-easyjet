"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton(): JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsSubmitting(true);

    try {
      await fetch("/api/session/logout", {
        method: "POST",
      });
      router.replace("/connexion");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button onClick={handleLogout} type="button" variant="ghost">
      {isSubmitting ? "Déconnexion..." : "Déconnexion"}
    </Button>
  );
}
