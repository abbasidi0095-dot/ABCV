"use client";

import { useEffect, useRef, ReactNode } from "react";

interface Props {
  /** Changes whenever the step changes; triggers the enter animation. */
  stepKey: string;
  /** Direction: 1 = forward (slide from right), -1 = back (slide from left). */
  direction?: 1 | -1;
  children: ReactNode;
}

/**
 * Wraps wizard step content and animates the new content in via GSAP
 * (fade + slide-x based on direction). Leaves the previous DOM
 * available long enough to animate out via the key-driven React swap.
 */
export function StepTransition({ stepKey, direction = 1, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { gsap } = await import("gsap");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const el = ref.current;
        if (!el) return;
        if (reduce) {
          gsap.set(el, { x: 0, opacity: 1 });
          return;
        }
        const x = direction === 1 ? 40 : -40;
        gsap.fromTo(
          el,
          { x, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.32, ease: "power2.out" },
        );
        cleanup = () => { gsap.killTweensOf(el); };
      } catch { /* */ }
    })();
    return () => cleanup();
  }, [stepKey, direction]);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}