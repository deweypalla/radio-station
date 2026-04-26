"use client";

import { useEffect } from "react";

/**
 * Registers the app service worker in production only.
 * Spotify Web Playback still requires a user gesture to start audio on mobile browsers.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* ignore registration failures (e.g. HTTP on local dev) */
      });
  }, []);

  return null;
}
