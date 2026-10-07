"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PinLock({ onUnlocked }: { onUnlocked: () => void }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const digitsRef = useRef("");
  const busyRef = useRef(false);

  const reject = useCallback((message: string) => {
    digitsRef.current = "";
    setDigits("");
    setError(message);
    setShake(true);
    busyRef.current = false;
    window.setTimeout(() => setShake(false), 480);
  }, []);

  const submit = useCallback(
    async (pin: string) => {
      busyRef.current = true;
      setError("");
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          reject(data?.error || "Incorrect PIN");
          return;
        }
        onUnlocked();
      } catch {
        reject("The app did not respond. Try again.");
      }
    },
    [onUnlocked, reject],
  );

  const push = useCallback(
    (digit: string) => {
      if (busyRef.current || digitsRef.current.length >= 4) return;
      const next = digitsRef.current + digit;
      digitsRef.current = next;
      setDigits(next);
      setError("");
      if (next.length === 4) void submit(next);
    },
    [submit],
  );

  const backspace = useCallback(() => {
    if (busyRef.current || digitsRef.current.length === 0) return;
    const next = digitsRef.current.slice(0, -1);
    digitsRef.current = next;
    setDigits(next);
    setError("");
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") push(event.key);
      else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backspace, push]);

  return (
    <section className="lock-screen">
      <header className="topbar">
        <h1 className="mark">H2GROW</h1>
        <ThemeToggle />
      </header>
      <div className="lock-body">
        <div className="lock-copy">
          <p className="lock-title">Enter PIN</p>
          <div className={`dots ${shake ? "shake" : ""}`} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className={index < digits.length ? "dot filled" : "dot"} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {digits.length} of 4 digits entered
          </p>
          <p className="pin-error" role="alert">
            {error}
          </p>
        </div>
        <div className="keypad" role="group" aria-label="PIN keypad">
          {KEYS.map((key) => {
            if (key === "") return <span key="spacer" />;
            if (key === "del") {
              return (
                <button key="del" type="button" className="key key-ghost" onClick={backspace} aria-label="Delete">
                  Del
                </button>
              );
            }
            return (
              <button key={key} type="button" className="key" onClick={() => push(key)}>
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
