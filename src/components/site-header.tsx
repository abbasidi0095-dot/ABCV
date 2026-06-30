"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { status } = useSession();
  return (
    <header className="sticky top-0 z-50 mx-auto mt-4 w-[calc(100%-2rem)] max-w-6xl rounded-2xl border border-border/50 bg-white/60 px-6 backdrop-blur-xl transition-all duration-300">
      <div className="flex h-14 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ab</span>CV
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {status === "authenticated" ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard" prefetch={false}>Dashboard</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-sm hover:shadow-md hover:shadow-primary/20">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}