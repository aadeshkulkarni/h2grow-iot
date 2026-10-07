"use client";

import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { PinLock } from "@/components/PinLock";

type Screen = "loading" | "lock" | "home";

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as { authenticated?: boolean };
        if (!cancelled) setScreen(data.authenticated ? "home" : "lock");
      } catch {
        if (!cancelled) setScreen("lock");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(() => setScreen("home"), []);
  const lock = useCallback(() => {
    setScreen("lock");
    void fetch("/api/logout", { method: "POST" });
  }, []);

  return (
    <div className="stage">
      <div className="ambient" aria-hidden="true" />
      <main className="frame">
        {screen === "loading" && (
          <div className="splash">
            <p className="mark">H2GROW</p>
          </div>
        )}
        {screen === "lock" && <PinLock onUnlocked={unlock} />}
        {screen === "home" && <Dashboard onLock={lock} />}
      </main>
    </div>
  );
}
