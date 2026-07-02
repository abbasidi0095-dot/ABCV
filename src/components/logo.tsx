"use client";

import { useId } from "react";

interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/** Animated CV/document glyph logo. Clean rounded square with document fold +
 *  three text rows; draws itself in via GSAP strokes when `animated` (on hero). */
export function LogoMark({ size = 32, className, animated = false }: LogoProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        fill={`url(#${id}-grad)`}
        data-logo-fill
      />
      <g
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-logo-rows
      >
        <path d="M15 16 h15" className="logo-row-a" strokeDasharray="20" strokeDashoffset={animated ? 20 : 0} />
        <path d="M15 23 h11" className="logo-row-b" strokeDasharray="20" strokeDashoffset={animated ? 20 : 0} />
        <path d="M15 30 h13" className="logo-row-c" strokeDasharray="20" strokeDashoffset={animated ? 20 : 0} />
      </g>
      <path
        d="M30 9 v8 h8 z"
        fill="var(--accent)"
        data-logo-fold
        transform={animated ? "rotate(-90 30 9)" : "rotate(0)"}
        style={{ transformOrigin: "30px 9px" }}
      />
    </svg>
  );
}

/** Full logo lockup with wordmark. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-foreground" style={{ fontSize: size * 0.55 }}>
        ab<span className="text-primary">CV</span>
      </span>
    </span>
  );
}