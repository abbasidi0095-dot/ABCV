"use client";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import { GsapProvider } from "@/components/gsap-provider";
import React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GsapProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <I18nProvider>
          {children}
        </I18nProvider>
      </ThemeProvider>
    </GsapProvider>
  );
}
