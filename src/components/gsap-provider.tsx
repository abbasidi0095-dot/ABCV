"use client";

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";

const GsapCtx = createContext(false);
export const useGsapReady = () => useContext(GsapCtx);

/**
 * Client-only provider that lazy-imports gsap + ScrollTrigger on mount,
 * sets up Lenis smooth scroll, integrates with ScrollTrigger, and respects
 * prefers-reduced-motion (skips Lenis when requested). Registers the
 * useGSAP hook. SSR-safe (all gsap imports happen inside useEffect).
 */
export function GsapProvider({ children }: { children: ReactNode }) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let lenis: import("lenis").default | undefined;
    let cancelled = false;
    const req = async () => {
      try {
        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        const { useGSAP } = await import("@gsap/react");
        const Lenis = (await import("lenis")).default;
        gsap.registerPlugin(ScrollTrigger, useGSAP);

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const isTouch = window.matchMedia("(pointer: coarse)").matches;

        if (!reduceMotion && !isTouch) {
          lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
          function raf(time: number) {
            lenis!.raf(time);
            rafRef.current = requestAnimationFrame(raf);
          }
          rafRef.current = requestAnimationFrame(raf);
          lenis.on("scroll", ScrollTrigger.update);
        } else {
          document.documentElement.classList.add("lenis-stopped");
        }
      } catch {
        /* gsap/lenis failed to load — fall back to native */
      }
    };
    req();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (lenis) lenis.destroy?.();
      void cancelled;
    };
  }, []);

  return <GsapCtx.Provider value>{children}</GsapCtx.Provider>;
}