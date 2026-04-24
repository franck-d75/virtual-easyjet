"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 10 * 60 * 1_000;

export function SessionKeepAlive() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetch("/api/session/refresh", {
        method: "POST",
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
