export type AdminFeedback = {
  tone: "success" | "danger";
  message: string;
};

export function handleAdminUnauthorized(
  response: Response,
  fallbackMessage = "Votre session a expiré. Merci de vous reconnecter.",
): boolean {
  if (response.status !== 401) {
    return false;
  }

  if (typeof window !== "undefined") {
    const redirectUrl = new URL("/connexion", window.location.origin);
    redirectUrl.searchParams.set("reason", "session-expired");
    redirectUrl.searchParams.set("message", fallbackMessage);
    window.location.assign(redirectUrl.toString());
  }

  return true;
}

export function parseJsonPayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function extractApiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}
