"use client";

import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 px-6 py-8 text-center">
      <p className="text-xs text-muted-foreground">
        ab<span className="text-primary font-medium">CV</span> — {t("app.tagline")}
      </p>
    </footer>
  );
}