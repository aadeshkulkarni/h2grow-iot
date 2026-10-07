"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "h2grow-theme";

function readTheme(): "light" | "dark" {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f1ea" : "#080a09");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const next = readTheme();
    applyTheme(next);
    setTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const system = media.matches ? "light" : "dark";
      applyTheme(system);
      setTheme(system);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setTheme(next);
  }

  const label = theme === "light" ? "Dark" : "Light";

  return (
    <button
      type="button"
      className="lock"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      suppressHydrationWarning
    >
      {label}
    </button>
  );
}
