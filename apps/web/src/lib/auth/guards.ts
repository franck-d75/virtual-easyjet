import { redirect } from "next/navigation";

import { ApiError } from "../api/client";
import type { UserMeResponse } from "../api/types";
import { getServerSession } from "./session";

type PilotSession = {
  accessToken: string;
  refreshToken: string | null;
  user: UserMeResponse & {
    pilotProfile: NonNullable<UserMeResponse["pilotProfile"]>;
  };
};

type AdminSession = {
  accessToken: string;
  refreshToken: string | null;
  user: UserMeResponse;
};

export async function requirePilotSession(): Promise<PilotSession> {
  const session = await getServerSession();

  if (!session || !session.user.pilotProfile) {
    redirect("/connexion");
  }

  return session as PilotSession;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getServerSession();

  if (!session) {
    redirect("/connexion");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
}

export function handleProtectedPageApiError(error: unknown): void {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      redirect("/connexion");
    }

    if (error.status === 403) {
      redirect("/dashboard");
    }
  }
}
