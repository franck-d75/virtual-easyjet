"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  installBrowserDiagnostics,
  logBrowserDiagnostic,
} from "@/lib/diagnostics/browser-journal";

export function BrowserDiagnosticsBootstrap(): null {
  const pathname = usePathname();

  useEffect(() => {
    installBrowserDiagnostics();
  }, []);

  useEffect(() => {
    logBrowserDiagnostic("browser.page.view", "info", {
      pathname,
      href: typeof window === "undefined" ? null : window.location.href,
    });
  }, [pathname]);

  return null;
}
