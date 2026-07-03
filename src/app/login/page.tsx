"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, LogIn } from "lucide-react";

export default function LoginPage() {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Surface any auth error passed back from the Cognito callback (?error=auth&message=...).
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    if (params.get("error") === "auth" && message) {
      toast.error(t("login.error"), { description: message });
      // Clean the URL so the toast doesn't re-fire on refresh.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [t]);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cardRef.current) {
          gsap.fromTo(
            cardRef.current,
            { y: 24, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }
          );
          cleanup = () => gsap.killTweensOf(cardRef.current);
        }
      } catch {}
    })();
    return () => cleanup();
  }, []);

  const handleContinue = () => {
    setRedirecting(true);
    // GET /api/auth/signin sets the CSRF state cookie and 302s to the Cognito Hosted UI.
    window.location.href = "/api/auth/signin";
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <div ref={cardRef}>
        <Card className="w-full max-w-sm rounded-2xl border-border/60 p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("login.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>

          <div className="space-y-4">
            <Button className="w-full" onClick={handleContinue} disabled={redirecting}>
              <LogIn className="size-4" />
              {redirecting ? t("login.signing") : t("login.button")}
            </Button>

            <p className="pt-1 text-center">
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="size-4" />{t("login.back")}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
