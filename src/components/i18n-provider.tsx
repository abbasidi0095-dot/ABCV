"use client";
import { useState, useCallback, type ReactNode } from "react";
import { I18nContext, translations, type Locale } from "@/lib/i18n";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useCallback((key: string) => translations[locale as Locale]?.[key] ?? key, [locale]);
  return (
    <I18nContext value={{ locale, setLocale, t }}>
      {children}
    </I18nContext>
  );
}
