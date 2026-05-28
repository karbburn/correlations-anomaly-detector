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
    <div className="flex items-center border border-border-muted bg-background p-0.5 font-mono text-xs">
      <button
        onClick={() => toggle("dark")}
        className={clsx(
          "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-150 rounded-none cursor-pointer",
          theme === "dark"
            ? "bg-accent-primary text-black"
            : "text-muted hover:text-foreground hover:bg-elevated"
        )}
      >
        DARK
      </button>
      <button
        onClick={() => toggle("light")}
        className={clsx(
          "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-150 rounded-none cursor-pointer",
          theme === "light"
            ? "bg-accent-primary text-black"
            : "text-muted hover:text-foreground hover:bg-elevated"
        )}
      >
        LIGHT
      </button>
    </div>
  );
}
