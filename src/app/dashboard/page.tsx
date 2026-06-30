"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

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

  useEffect(() => {
    fetch("/api/cvs")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setCvs(d.cvs))
      .catch(() => setCvs([]));
  }, []);

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
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your CVs</h1>
          <p className="text-sm text-muted-foreground">
            Create a tailored CV from any job posting, or revisit and edit existing ones.
          </p>
        </div>
        <Button asChild>
          <Link href="/new" prefetch={false}>+ New CV</Link>
        </Button>
      </div>

      <div className="mt-8">
        {cvs === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : cvs.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No CVs yet.</p>
            <Button asChild className="mt-4">
              <Link href="/new" prefetch={false}>Create your first CV</Link>
            </Button>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cvs.map((c) => (
              <li key={c.id}>
                <Card className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <h3 className="font-medium">{c.fullName}</h3>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Template: <span className="capitalize">{c.templateId}</span> · Updated {fmtDate(c.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/new?cv=${c.id}`} prefetch={false}>Edit</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                      Delete
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