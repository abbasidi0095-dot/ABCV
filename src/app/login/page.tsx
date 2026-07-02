"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      await api("/api/auth/signin", { email, password });
      toast.success("Signed in");
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Sign-in failed", { description: msg });
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
      toast.success("Account created — welcome!");
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Sign-up failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to abCV</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your email, or create a new account.
          </p>
        </div>

        {step === "choice" && (
          <div className="space-y-3">
            <Label htmlFor="choice-email">Email</Label>
            <Input
              id="choice-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!email || busy}
                onClick={() => { if (email) setStep("signin"); }}
              >
                Sign in
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                disabled={!email || busy}
                onClick={() => { if (email) setStep("signup"); }}
              >
                Create account
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/" className="underline">Back home</Link>
            </p>
          </div>
        )}

        {step === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="si-email">Email</Label>
              <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-password">Password</Label>
              <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setStep("choice")}>
              ← Back
            </button>
          </form>
        )}

        {step === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="su-name">Full name</Label>
              <Input id="su-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-email">Email</Label>
              <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-password">Password (min 8 characters)</Label>
              <Input id="su-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Creating account…" : "Create account"}
            </Button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setStep("choice")}>
              ← Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
