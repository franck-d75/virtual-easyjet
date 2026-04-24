"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ApiActionButtonProps = {
  endpoint: string;
  body?: unknown;
  label: string;
  pendingLabel: string;
  successMessage?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
};

type ActionFeedback = {
  tone: "success" | "danger";
  message: string;
};

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function ApiActionButton({
  endpoint,
  body,
  label,
  pendingLabel,
  successMessage,
  variant = "secondary",
  className,
  disabled = false,
  confirmMessage,
}: ApiActionButtonProps): JSX.Element {
  const router = useRouter();
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleClick(): Promise<void> {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    setFeedback(null);

    const requestInit: RequestInit = {
      method: "POST",
    };

    if (body !== undefined) {
      requestInit.headers = {
        "Content-Type": "application/json",
      };
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, requestInit);

    const rawPayload = await response.text();
    const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

    if (!response.ok) {
      setFeedback({
        tone: "danger",
        message: extractMessage(payload, "Action impossible pour le moment."),
      });
      return;
    }

    setFeedback({
      tone: "success",
      message: successMessage ?? "Action effectuée avec succès.",
    });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className={cn("action-stack", className)}>
      <Button
        disabled={disabled || isPending}
        onClick={() => {
          void handleClick();
        }}
        type="button"
        variant={variant}
      >
        {isPending ? pendingLabel : label}
      </Button>
      {feedback ? (
        <p
          className={cn(
            "inline-feedback",
            feedback.tone === "danger"
              ? "inline-feedback--danger"
              : "inline-feedback--success",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
