import { redirect } from "next/navigation";

import type { UserMeResponse } from "../api/types";
import { getServerSession } from "./session";

type PilotSession = {
  accessToken: string;
  refreshToken: string | null;
  user: UserMeResponse & {
    pilotProfile: NonNullable<UserMeResponse["pilotProfile"]>;
  };
};

export async function requirePilotSession(): Promise<PilotSession> {
  const session = await getServerSession();

  if (!session || !session.user.pilotProfile) {
    redirect("/connexion");
  }

  return session as PilotSession;
}
