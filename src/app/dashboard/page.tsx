"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkeletonCard } from "@/components/skeleton-card";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

interface CvRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  templateId: string;
  updatedAt: string;
}

const fmtDate = (s: string) => new Date(s).toLocaleString();

export default function DashboardPage() {
  const [cvs, setCvs] = useState<CvRow[] | null>(null);
  const { t } = useI18n();
  const gridRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetch("/api/cvs")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setCvs(d.cvs))
      .catch(() => setCvs([]));
  }, []);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      if (cvs === null || cvs.length === 0) return;
      try {
        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !gridRef.current) return;
        gsap.fromTo(
          gridRef.current.children,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out" },
        );
        cleanup = () => gsap.killTweensOf(gridRef.current!.children);
      } catch {}
    })();
    return () => cleanup();
  }, [cvs]);

  const remove = async (id: string) => {
    if (!confirm("Delete this CV?")) return;
    const r = await fetch(`/api/cvs/${id}`, { method: "DELETE" });
    if (r.ok) {
      setCvs((c) => (c ?? []).filter((c) => c.id !== id));
      toast.success("CV deleted");
    } else {
      toast.error("Failed to delete CV");
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/new" prefetch={false}>
            <Plus className="size-4" />{t("dashboard.new")}
          </Link>
        </Button>
      </div>

      <div className="mt-6 sm:mt-8">
        {cvs === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : cvs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <FileText className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
            <Button asChild size="sm">
              <Link href="/new" prefetch={false}>{t("dashboard.empty.cta")}</Link>
            </Button>
          </Card>
        ) : (
          <ul ref={gridRef} className="grid gap-3 sm:grid-cols-2">
            {cvs.map((c) => (
              <li key={c.id}>
                <Card className="flex items-start justify-between gap-4 p-4 transition-colors duration-200 hover:border-primary/30">
                  <div className="min-w-0">
                    <h3 className="font-medium">{c.fullName}</h3>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("dashboard.template")}: <span className="capitalize">{c.templateId}</span> · {t("dashboard.updated")} {fmtDate(c.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/new?cv=${c.id}`} prefetch={false}>
                        <Pencil className="size-3.5" />{t("dashboard.edit")}
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="size-3.5" />{t("dashboard.delete")}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}