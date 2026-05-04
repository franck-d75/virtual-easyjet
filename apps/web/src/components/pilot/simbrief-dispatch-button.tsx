"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  SimbriefDispatchUrlResponse,
  SimbriefPrepareFlightResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

type SimbriefDispatchButtonProps = {
  bookingId: string;
  aircraftRegistration: string;
  aircraftIcao: string;
  className?: string;
};

type ActionFeedback = {
  tone: "success" | "danger";
  message: string;
};

const SIMBRIEF_POPUP_NAME = "virtualEasyjetSimbriefDispatch";
const SIMBRIEF_POPUP_FEATURES =
  "popup=yes,width=1180,height=840,scrollbars=yes,resizable=yes";
const SIMBRIEF_POLL_INTERVAL_MS = 8_000;
const SIMBRIEF_POLL_ATTEMPTS = 30;

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const rawPayload = await response.text();
  const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

  if (!response.ok) {
    throw new Error(extractMessage(payload, fallbackMessage));
  }

  return payload as T;
}

export function SimbriefDispatchButton({
  bookingId,
  aircraftRegistration,
  aircraftIcao,
  className,
}: SimbriefDispatchButtonProps): JSX.Element {
  const router = useRouter();
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasOpenedDispatch, setHasOpenedDispatch] = useState(false);
  const [dispatchUrl, setDispatchUrl] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refreshReservationPage(): void {
    startTransition(() => {
      router.refresh();
    });
  }

  async function fetchDispatchUrl(): Promise<SimbriefDispatchUrlResponse> {
    const response = await fetch("/api/pilot/simbrief/dispatch-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        returnUrl: `${window.location.origin}/reservation`,
      }),
    });

    return readJsonResponse<SimbriefDispatchUrlResponse>(
      response,
      "Impossible d'ouvrir SimBrief pour cette reservation.",
    );
  }

  async function importGeneratedOfp(
    waitForMatch: boolean,
  ): Promise<SimbriefPrepareFlightResponse> {
    const response = await fetch("/api/pilot/simbrief/prepare-flight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        detectedRegistration: aircraftRegistration,
        detectedAircraftIcao: aircraftIcao,
        waitForMatch,
      }),
    });

    return readJsonResponse<SimbriefPrepareFlightResponse>(
      response,
      "Impossible d'importer l'OFP SimBrief.",
    );
  }

  function handleReady(payload: SimbriefPrepareFlightResponse): void {
    if (payload.status !== "READY") {
      return;
    }

    setFeedback({
      tone: "success",
      message: payload.message || "Vol SimBrief pret pour ACARS.",
    });
    refreshReservationPage();
  }

  async function waitForGeneratedOfp(): Promise<void> {
    for (let attempt = 0; attempt < SIMBRIEF_POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(SIMBRIEF_POLL_INTERVAL_MS);
      }

      const payload = await importGeneratedOfp(true);

      if (payload.status === "READY") {
        handleReady(payload);
        return;
      }

      if (attempt === 0) {
        setFeedback({
          tone: "success",
          message:
            "SimBrief est ouvert. Generez l'OFP dans la fenetre SimBrief, le site l'importera des qu'il correspond a la reservation.",
        });
      }
    }

    setFeedback({
      tone: "success",
      message:
        "SimBrief reste ouvert. Une fois l'OFP genere, utilisez Importer l'OFP genere.",
    });
  }

  async function handleDispatchClick(): Promise<void> {
    setIsSubmitting(true);
    setFeedback(null);
    setDispatchUrl(null);
    setPopupBlocked(false);

    const popupWindow = window.open(
      "about:blank",
      SIMBRIEF_POPUP_NAME,
      SIMBRIEF_POPUP_FEATURES,
    );

    try {
      const dispatch = await fetchDispatchUrl();
      setDispatchUrl(dispatch.url);
      setHasOpenedDispatch(true);

      if (popupWindow) {
        popupWindow.location.href = dispatch.url;
        popupWindow.focus();
      } else {
        setPopupBlocked(true);
      }

      await waitForGeneratedOfp();
    } catch (error) {
      popupWindow?.close();
      setFeedback({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de preparer SimBrief pour le moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualImportClick(): Promise<void> {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      handleReady(await importGeneratedOfp(false));
    } catch (error) {
      setFeedback({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'importer l'OFP SimBrief.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("action-stack", className)}>
      <Button
        disabled={isSubmitting || isPending}
        onClick={() => {
          void handleDispatchClick();
        }}
        type="button"
        variant="primary"
      >
        {isSubmitting ? "Liaison SimBrief..." : "Generer via SimBrief"}
      </Button>

      {hasOpenedDispatch && !isSubmitting ? (
        <Button
          disabled={isPending}
          onClick={() => {
            void handleManualImportClick();
          }}
          type="button"
          variant="secondary"
        >
          Importer l'OFP genere
        </Button>
      ) : null}

      {popupBlocked && dispatchUrl ? (
        <a
          className="button button--secondary"
          href={dispatchUrl}
          rel="noreferrer"
          target="_blank"
        >
          Ouvrir SimBrief
        </a>
      ) : null}

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
