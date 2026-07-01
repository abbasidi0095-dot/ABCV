"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <I18nProvider>
          {children}
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
