"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n, locales } from "@/lib/i18n";

export function SiteHeader() {
  const { status } = useSession();
  const { t, locale, setLocale } = useI18n();

  return (
    <header className="sticky top-0 z-50 mx-auto mt-4 w-[calc(100%-2rem)] max-w-6xl rounded-2xl border border-border/50 bg-card/60 px-4 backdrop-blur-xl transition-all duration-300 sm:px-6">
      <div className="flex h-14 items-center justify-between gap-2">
        <Link href="/" className="text-lg font-bold tracking-tight shrink-0">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ab</span>CV
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="h-8 rounded-md border border-border bg-transparent px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={t("nav.language")}
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>

          <ThemeToggle />

          {status === "authenticated" ? (
            <>
              <Button asChild size="sm" variant="ghost" className="text-xs sm:text-sm">
                <Link href="/dashboard" prefetch={false}>{t("nav.dashboard")}</Link>
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={() => signOut({ callbackUrl: "/" })}>
                {t("nav.signout")}
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-sm hover:shadow-md hover:shadow-primary/20 text-xs sm:text-sm">
              <Link href="/login">{t("nav.signin")}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
