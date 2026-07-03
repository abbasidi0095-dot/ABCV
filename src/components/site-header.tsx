"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n, locales } from "@/lib/i18n";
import { LogoMark } from "@/components/logo";

function checkSession(): Promise<boolean> {
  return fetch("/api/auth/session")
    .then((r) => r.json())
    .then((d) => !!d.user)
    .catch(() => false);
}

export function SiteHeader() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    checkSession().then((a) => { setAuthed(a); setChecking(false); });
  }, []);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (!headerRef.current) return;
        gsap.from(headerRef.current, { y: -20, opacity: 0, duration: 0.5, ease: "power3.out" });
        cleanup = () => gsap.killTweensOf(headerRef.current);
      } catch {}
    })();
    return () => cleanup();
  }, []);

  const handleSignOut = async () => {
    const res = await fetch("/api/auth/session", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    // If Cognito gave us an end-session URL, go there to clear the IdP session too.
    window.location.href = data?.logoutUrl ?? "/";
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-3 sm:top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-6xl rounded-2xl border border-border/50 bg-card/70 px-3 backdrop-blur-xl sm:px-5"
    >
      <div className="flex h-14 items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="abCV">
          <LogoMark size={28} />
          <span className="font-semibold tracking-tight text-foreground">
            ab<span className="text-primary">CV</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 sm:hidden"
            aria-label={t("nav.language")}
          >
            {locale.toUpperCase()}
          </button>
          {open && (
            <div className="absolute right-3 top-16 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-sm sm:hidden">
              {locales.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLocale(l.code as typeof locale); setOpen(false); }}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-muted/60 ${locale === l.code ? "text-primary font-medium" : ""}`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          )}

          <div className="hidden gap-1 sm:flex sm:items-center">
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLocale(l.code as typeof locale)}
                className={`h-7 rounded-md px-2 text-xs transition-colors ${locale === l.code ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                aria-label={l.native}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>

          <ThemeToggle />

          {authed ? (
            <>
              <Button asChild size="sm" variant="ghost" className="text-xs sm:text-sm">
                <Link href="/dashboard" prefetch={false}>{t("nav.dashboard")}</Link>
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={handleSignOut}>
                {t("nav.signout")}
              </Button>
            </>
          ) : !checking ? (
            <Button asChild size="sm" className="text-xs sm:text-sm">
              <Link href="/login">{t("nav.signin")}</Link>
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}