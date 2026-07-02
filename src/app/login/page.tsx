"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";

type AuthStep = "choice" | "signin" | "signup";

async function api(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.code ? `[${data.code}] ${data.error}` : (data.error ?? "Request failed"));
  return data;
}

export default function LoginPage() {
  const [step, setStep] = useState<AuthStep>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cardRef.current) {
          gsap.fromTo(cardRef.current, { y: 24, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" });
          cleanup = () => gsap.killTweensOf(cardRef.current);
        }
      } catch {}
    })();
    return () => cleanup();
  }, [step]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      await api("/api/auth/signin", { email, password });
      toast.success(t("login.success"));
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("login.error"), { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setBusy(true);
    try {
      await api("/api/auth/signup", { email, password, name });
      await api("/api/auth/signin", { email, password });
      toast.success(t("login.success"));
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("login.error"), { description: msg });
    } finally {
      setBusy(false);
    }
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
          {step === "choice" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="choice-email">{t("login.email")}</Label>
                <Input
                  id="choice-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!email || busy} onClick={() => { if (email) setStep("signin"); }}>
                  {t("login.button")}
                </Button>
                <Button className="flex-1" variant="secondary" disabled={!email || busy} onClick={() => { if (email) setStep("signup"); }}>
                  Create account
                </Button>
              </div>
              <p className="pt-1 text-center">
                <Link href="/" className="text-sm text-primary hover:underline">{t("login.back")}</Link>
              </p>
            </div>
          )}

          {step === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">{t("login.email")}</Label>
                <Input id="si-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-password">{t("login.password")}</Label>
                <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t("login.signing") : t("login.button")}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setStep("choice")}>
                <ArrowLeft className="size-4" />{t("login.back")}
              </Button>
            </form>
          )}

          {step === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Full name</Label>
                <Input id="su-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">{t("login.email")}</Label>
                <Input id="su-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">{t("login.password")}</Label>
                <Input id="su-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t("login.signing") : "Create account"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setStep("choice")}>
                <ArrowLeft className="size-4" />{t("login.back")}
              </Button>
            </form>
          )}
        </div>
      </Card>
      </div>
    </main>
  );
}