"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function Home() {
  const { status } = useSession();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Powered by Kimi&nbsp;K2.6 via OpenCode&nbsp;Go
      </div>
      <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
        Paste a job. Get a tailored CV. <span className="text-primary">In&nbsp;seconds.</span>
      </h1>
      <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
        abCV reads any job posting, generates realistic job-specific experience, mixes in your name,
        email, phone, and photo, and ships a beautifully formatted PDF — yours to edit before download.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {status === "authenticated" ? (
          <Button asChild size="lg">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/login">Sign in to start</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/new">Try a sample</Link>
            </Button>
          </>
        )}
      </div>
      <ul className="mt-14 grid max-w-3xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <li className="rounded-lg border p-4 text-left">
          <strong className="text-foreground">1 — Job link or text</strong>
          <br />Paste a URL or paste the posting text. We parse it via Kimi K2.6.
        </li>
        <li className="rounded-lg border p-4 text-left">
          <strong className="text-foreground">2 — Your details</strong>
          <br />Add your name, email, phone, and a photo. We handle the rest.
        </li>
        <li className="rounded-lg border p-4 text-left">
          <strong className="text-foreground">3 — Edit &amp; download</strong>
          <br />Pick a template, tweak fields, get an A4 PDF in one click.
        </li>
      </ul>
    </main>
  );
}