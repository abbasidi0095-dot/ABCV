"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 px-6 py-8">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <p className="text-sm text-muted-foreground">
          ab<span className="text-primary font-medium">CV</span> — {t("app.tagline")}
        </p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
          <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
        </div>
      </div>
    </footer>
  );
}