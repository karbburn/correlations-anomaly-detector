"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import clsx from "clsx";

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = saved || "dark";
    setTheme(initialTheme);
    if (initialTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [setTheme]);

  const toggle = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  return (
    <div className="flex items-center border border-border-muted bg-background p-0.5 font-mono text-xs" role="radiogroup" aria-label="Theme selector">
      <button
        onClick={() => toggle("dark")}
        role="radio"
        aria-checked={theme === "dark"}
        aria-label="Dark theme"
        className={clsx(
          "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-150 rounded-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          theme === "dark"
            ? "bg-accent-primary text-white"
            : "text-muted hover:text-foreground hover:bg-elevated"
        )}
      >
        DARK
      </button>
      <button
        onClick={() => toggle("light")}
        role="radio"
        aria-checked={theme === "light"}
        aria-label="Light theme"
        className={clsx(
          "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-150 rounded-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          theme === "light"
            ? "bg-accent-primary text-white"
            : "text-muted hover:text-foreground hover:bg-elevated"
        )}
      >
        LIGHT
      </button>
    </div>
  );
}
