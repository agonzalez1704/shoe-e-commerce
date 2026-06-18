"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // sync with whatever the pre-paint script already set
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted transition-colors hover:text-text active:scale-95"
    >
      {theme === "dark" ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  );
}
