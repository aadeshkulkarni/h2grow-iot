"use client";

import { useEffect, useRef, useState } from "react";
import { BoardSetup } from "@/components/BoardSetup";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { DeviceStatus } from "@/lib/types";

export function Dashboard({ onLock }: { onLock: () => void }) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pendingRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (pendingRef.current || loadingRef.current) return;
      loadingRef.current = true;
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (response.status === 401) {
          onLock();
          return;
        }
        const data = (await response.json()) as DeviceStatus;
        if (!cancelled) {
          setStatus(data);
          if (data.online) setError("");
          else if (data.message) setError(data.message);
        }
      } catch {
        if (!cancelled) setError("The reading could not be refreshed.");
      } finally {
        loadingRef.current = false;
      }
    }

    void load();
    const poll = window.setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [onLock]);

  async function toggle() {
    if (!status?.online || pendingRef.current) return;
    const next = !status.relay;
    pendingRef.current = true;
    setPending(true);
    setError("");
    setStatus({ ...status, relay: next });

    try {
      const response = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      if (response.status === 401) {
        onLock();
        return;
      }
      const data = (await response.json()) as DeviceStatus;
      if (!data.online) {
        setStatus({ ...status, relay: status.relay });
        setError(data.message || "The switch did not reach the board.");
      } else {
        setStatus(data);
      }
    } catch {
      setStatus(status);
      setError("The switch did not reach the board.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (showSetup) return <BoardSetup onClose={() => setShowSetup(false)} />;

  const online = status?.online ?? false;
  const relayOn = status?.relay ?? false;
  const pill = !status ? "Connecting" : !online ? "Offline" : status.mode === "preview" ? "Preview" : "Live";

  return (
    <section className="dashboard">
      <header className="topbar">
        <h1 className="mark">H2GROW</h1>
        <span className={`pill ${pill.toLowerCase()}`}>
          <i />
          {pill}
        </span>
      </header>

      <div className="reading">
        <div className="stats">
          <Stat
            label="Temperature"
            value={status?.temperature == null ? null : status.temperature.toFixed(1)}
            unit="°"
            unavailable="Temperature unavailable"
          />
          <Stat
            label="Humidity"
            value={status?.humidity == null ? null : String(Math.round(status.humidity))}
            unit="%"
            unavailable="Humidity unavailable"
          />
        </div>
        <p className="climate">{caption(status)}</p>
        {status?.mode === "preview" && (
          <p className="note">Sample readings, so you can try the app before the board is online.</p>
        )}
      </div>

      <div className="controls">
        <button
          type="button"
          role="switch"
          aria-checked={relayOn}
          aria-busy={pending}
          className={relayOn ? "relay on" : "relay"}
          onClick={() => void toggle()}
          disabled={!online || pending}
        >
          <span>
            <span className="eyebrow">Switch</span>
            <span className="switch-state">{relayOn ? "On" : "Off"}</span>
            <span className="switch-hint">
              {status && !online ? "Waiting for the board" : "Relay channel"}
            </span>
          </span>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
        </button>
        <p className="note warn" role="alert">
          {error}
        </p>
        <p className="freshness">{status ? freshness(status.updatedAt, now) : "Reading the room"}</p>
        <div className="actions">
          <button type="button" className="lock" onClick={() => setShowSetup(true)}>
            Setup
          </button>
          <ThemeToggle />
          <button type="button" className="lock" onClick={onLock}>
            Lock
          </button>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  unavailable,
}: {
  label: string;
  value: string | null;
  unit: string;
  unavailable: string;
}) {
  return (
    <section className="stat" aria-label={value == null ? unavailable : `${label} ${value}${unit}`}>
      <p className="eyebrow">{label}</p>
      <p className="stat-value">
        <span>{value ?? "—"}</span>
        {value != null && <span className="stat-unit">{unit}</span>}
      </p>
    </section>
  );
}

function caption(status: DeviceStatus | null) {
  if (!status) return "Reading the room";
  if (!status.online) return "Waiting for the board";
  if (status.temperature == null) return "Sensor is settling";
  if (status.temperature < 18) return "Cool in the room";
  if (status.temperature > 28) return "Warm in the room";
  if (status.humidity != null && status.humidity < 35) return "The air is dry";
  if (status.humidity != null && status.humidity > 70) return "The air is humid";
  return "Comfortable";
}

function freshness(updatedAt: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(updatedAt).getTime()) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}
