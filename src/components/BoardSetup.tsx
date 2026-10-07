"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type SetupInfo = {
  ssid: string;
  deviceKey: string;
  passwordSet: boolean;
  online: boolean;
  ports: string[];
  mode: "live" | "preview";
};

export function BoardSetup({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("h2grow-local");
  const [port, setPort] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/board", { cache: "no-store" });
      if (response.status === 401) {
        window.location.reload();
        return;
      }
      const data = (await response.json()) as SetupInfo;
      if (cancelled) return;
      setInfo(data);
      setSsid(data.ssid);
      setKey(data.deviceKey);
      setPort(data.ports[0] ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password, key, port }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "The settings did not reach the board.");
        return;
      }
      setSuccess(data.message || "The board is restarting.");
      setPassword("");
    } catch {
      setError("The app did not respond. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const usbName = port ? port.replace("/dev/", "") : "";

  return (
    <section className="setup">
      <header className="topbar">
        <h1 className="mark">H2GROW</h1>
        <div className="top-actions">
          <ThemeToggle />
          <button type="button" className="lock" onClick={onClose}>
            Back
          </button>
        </div>
      </header>

      <form className="setup-form" onSubmit={(event) => void save(event)}>
        <div>
          <p className="lock-title">Setup</p>
          <p className="note">
            Wi-Fi is saved on the ESP32. Saving restarts the board so it boots onto that network.
          </p>
        </div>

        <label className="field">
          <span className="eyebrow">Wi-Fi name</span>
          <input
            value={ssid}
            onChange={(event) => setSsid(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            required
          />
        </label>

        <label className="field">
          <span className="eyebrow">Wi-Fi password</span>
          <span className="field-row">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={63}
              placeholder={info?.passwordSet ? "Unchanged if left blank" : "Network password"}
            />
            <button
              type="button"
              className="field-toggle"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        <label className="field">
          <span className="eyebrow">Device key</span>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={64}
            required
          />
        </label>

        {info && info.ports.length > 1 && (
          <label className="field">
            <span className="eyebrow">USB port</span>
            <select value={port} onChange={(event) => setPort(event.target.value)}>
              {info.ports.map((item) => (
                <option key={item} value={item}>
                  {item.replace("/dev/", "")}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="note">
          {info?.online
            ? "The board is on the network. It will restart after saving."
            : usbName
              ? `USB is connected on ${usbName}. Close the Arduino Serial Monitor before saving.`
              : "Plug the ESP32 into this Mac with a data cable. The sketch has to be uploaded once before this form can restart it."}
        </p>

        <button type="submit" className="primary" disabled={busy || !info}>
          {busy ? "Restarting the board…" : "Save and restart"}
        </button>

        <p className="note warn" role="alert">
          {error}
        </p>
        {success && <p className="note success">{success}</p>}
      </form>
    </section>
  );
}
