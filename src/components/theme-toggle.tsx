"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSyncExternalStore, useRef } from "react";
import { Sun, Moon } from "lucide-react";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const iconRef = useRef<HTMLSpanElement>(null);

  const toggle = async () => {
    setTheme(theme === "dark" ? "light" : "dark");
    try {
      const { gsap } = await import("gsap");
      if (iconRef.current) {
        gsap.fromTo(iconRef.current, { rotate: -90, opacity: 0.2, scale: 0.7 }, { rotate: 0, opacity: 1, scale: 1, duration: 0.32, ease: "power2.out" });
      }
    } catch { /* */ }
  };

  if (!mounted) {
    return <div className="size-8" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-lg"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span ref={iconRef} className="inline-flex">
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </span>
    </Button>
  );
}
