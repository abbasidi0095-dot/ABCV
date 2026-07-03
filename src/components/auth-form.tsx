"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";

type Step = "choice" | "signin" | "signup" | "confirm";

async function api(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.code ? `[${data.code}] ${data.error}` : (data.error ?? "Request failed")) as Error & {
      code?: string;
    };
    err.code = data.code;
    throw err;
  }
  return data;
}

export function AuthForm({ onSuccessRedirect }: { onSuccessRedirect?: string }) {
  const [step, setStep] = useState<Step>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const handleSuccess = () => {
    toast.success(t("login.success"));
    window.location.href = onSuccessRedirect || "/dashboard";
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      await api("/api/auth/signin", { email, password });
      handleSuccess();
    } catch (err: unknown) {
      const e2 = err as Error & { code?: string };
      if (e2.code === "UnconfirmedUser") {
        toast.message(t("login.confirm.title"), { description: t("login.confirm.subtitle").replace("{email}", email) });
        setStep("confirm");
      } else {
        toast.error(t("login.error"), { description: e2.message });
      }
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
      toast.message(t("login.confirm.title"), { description: t("login.confirm.subtitle").replace("{email}", email) });
      setCode("");
      setStep("confirm");
    } catch (err: unknown) {
      toast.error(t("login.error"), { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;
    setBusy(true);
    try {
      await api("/api/auth/confirm", { email, code });
      toast.success(t("login.confirmed"));
      // Auto sign-in now that the account is confirmed.
      try {
        await api("/api/auth/signin", { email, password });
        handleSuccess();
      } catch (err: unknown) {
        // Confirmation succeeded but auto sign-in failed — send them to the sign-in step.
        toast.error(t("login.error"), { description: (err as Error).message });
        setStep("signin");
      }
    } catch (err: unknown) {
      toast.error(t("login.error"), { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await api("/api/auth/resend", { email });
      toast.success(t("login.codeSent"));
    } catch (err: unknown) {
      toast.error(t("login.error"), { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    step === "confirm"
      ? t("login.confirm.subtitle").replace("{email}", email)
      : t("login.subtitle");
  const title = step === "confirm" ? t("login.confirm.title") : t("login.title");

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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
              <Button className="flex-1" disabled={!email || busy} onClick={() => setStep("signin")}>
                {t("login.button")}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={!email || busy}
                onClick={() => setStep("signup")}
              >
                {t("login.createAccount")}
              </Button>
            </div>
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
            <Back t={t} onBack={() => setStep("choice")} />
          </form>
        )}

        {step === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="su-name">{t("login.name")}</Label>
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
              {busy ? t("login.signing") : t("login.createAccount")}
            </Button>
            <Back t={t} onBack={() => setStep("choice")} />
          </form>
        )}

        {step === "confirm" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cf-code">{t("login.code")}</Label>
              <Input
                id="cf-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-lg tracking-[0.5em]"
              />
            </div>
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
              {busy ? t("login.verifying") : t("login.verify")}
            </Button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={handleResend} disabled={busy} className="text-sm text-primary hover:underline">
                {t("login.resend")}
              </button>
              <button type="button" onClick={() => setStep("signin")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
                <ArrowLeft className="size-4" />{t("login.button")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Back({ t, onBack }: { t: (k: string) => string; onBack: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onBack}>
      <ArrowLeft className="size-4" />{t("login.back")}
    </Button>
  );
}
