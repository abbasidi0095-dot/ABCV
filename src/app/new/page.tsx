"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Step = "job" | "details" | "edit" | "style";

interface ParsedJob {
  jobTitle: string; company?: string | null; location?: string | null;
  requiredSkills: string[]; responsibilities: string[]; yearsExperience?: number | null; keywords: string[];
}
interface ExperienceEntry {
  company: string; title: string; startDate: string; endDate: string; bullets: string[];
}
interface CVContent {
  summary: string; experience: ExperienceEntry[]; skills: string[];
}
interface CvResponse {
  id: string;
  fullName: string; email: string; phone: string;
  templateId: string; accentColor: string; fontId: string;
  contentJson: CVContent;
}
interface TemplateMeta {
  id: string; name: string; description: string;
  accentDefault: string; fonts: string[];
}

const NewPage: NextPage = () => (
  <Suspense fallback={<main className="mx-auto max-w-4xl flex-1 px-6 py-10 text-sm text-muted-foreground">Loading…</main>}>
    <NewPageInner />
  </Suspense>
);

const NewPageInner = () => {
  const params = useSearchParams();
  const editId = params.get("cv");

  const [step, setStep] = useState<Step>("job");
  const [busy, setBusy] = useState(Boolean(editId));

  // Step 1: job
  const [jobMode, setJobMode] = useState<"url" | "text">("url");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [parsedJob, setParsedJob] = useState<ParsedJob | null>(null);

  // Step 2: details
  const [fullName, setFullName] = useState("");
  const [emailDetail, setEmailDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3/4: edit and style
  const [cvId, setCvId] = useState<string | null>(null);
  const [content, setContent] = useState<CVContent | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [templateId, setTemplateId] = useState("modern");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [fontId, setFontId] = useState("inter");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // Edit existing CV: jump straight to edit step.
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/cvs/${editId}`)
      .then((r) => r.json())
      .then((d) => {
        const cv = d.cv as CvResponse;
        setCvId(cv.id);
        setFullName(cv.fullName);
        setEmailDetail(cv.email);
        setPhone(cv.phone);
        setContent(cv.contentJson);
        setTemplateId(cv.templateId);
        setAccentColor(cv.accentColor);
        setFontId(cv.fontId);
        setStep("edit");
      })
      .catch(() => toast.error("Failed to load CV"))
      .finally(() => setBusy(false));
  }, [editId]);

  // Load templates once (needed in style step).
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates))
      .catch(() => {});
  }, []);

  // Refresh PDF preview whenever global fields change in style step.
  useEffect(() => {
    if (step !== "style" || !cvId) return;
    const t = setTimeout(() => void refreshPdf(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cvId, templateId, accentColor, fontId]);

  // NOTE: refreshPdf is defined below as a function declaration (hoisted).

  const onPickFile = (f: File | null) => {
    if (!f) return setPhoto(null), setPhotoUrl(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  };

  // Step 1 submit
  const analyzeJob = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          jobMode === "url" ? { sourceUrl: jobUrl } : { pastedText: jobText },
        ),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? d.error ?? "Failed");
      setJobId(d.job.id);
      setParsedJob(d.job.parsedJson as ParsedJob);
      setStep("details");
      toast.success("Job analyzed");
    } catch (e) {
      toast.error("Analyze failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Step 2 submit — generate CV
  const generateCv = async () => {
    if (!fullName || !emailDetail || !phone) {
      toast.error("All fields are required");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (jobId) fd.set("jobId", jobId);
      if (jobText && !jobId) fd.set("pastedText", jobText);
      fd.set("fullName", fullName);
      fd.set("email", emailDetail);
      fd.set("phone", phone);
      if (photo) fd.set("photo", photo);

      const r = await fetch("/api/cvs", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? d.error ?? "Failed");
      setCvId(d.cv.id);
      setContent(d.cv.contentJson as CVContent);
      setIssues(d.issues ?? []);
      setStep("edit");
      toast.success("CV generated");
    } catch (e) {
      toast.error("Generation failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Persist edits to server before going to style step.
  const saveEdits = async (): Promise<boolean> => {
    if (!cvId || !content) return false;
    const r = await fetch(`/api/cvs/${cvId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName, email: emailDetail, phone, content,
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error("Save failed", { description: d.detail ?? "" });
      return false;
    }
    return true;
  };

  async function refreshPdf() {
    if (!cvId) return;
    setRendering(true);
    try {
      const ok = await saveEdits();
      if (!ok) return;
      const r = await fetch(`/api/cvs/${cvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accentColor, fontId }),
      });
      if (!r.ok) throw new Error("Render failed");
      const blob = await r.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error("Preview failed", { description: (e as Error).message });
    } finally {
      setRendering(false);
    }
  }

  const downloadPdf = async () => {
    if (!cvId) return;
    try {
      const r = await fetch(`/api/cvs/${cvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accentColor, fontId }),
      });
      if (!r.ok) throw new Error("Render failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fullName.replace(/\s+/g, "_")}_CV.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Download failed", { description: (e as Error).message });
    }
  };

  // Edit helpers
  const patchExperience = (i: number, patch: Partial<ExperienceEntry>) => {
    setContent((c) => {
      if (!c) return c;
      const exp = [...c.experience];
      exp[i] = { ...exp[i], ...patch };
      return { ...c, experience: exp };
    });
  };
  const skillsValue = content?.skills ?? [];
  const setSkills = (csv: string) => {
    const arr = csv.split(",").map((s) => s.trim()).filter(Boolean);
    setContent((c) => (c ? { ...c, skills: arr } : c));
  };

  const activeTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Stepper step={step} />

      {step === "job" && (
        <Card className="mt-6 p-6">
          <h2 className="text-lg font-semibold">Tell us about the role</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll extract required skills, responsibilities, and keywords, then tailor a CV to match.
          </p>
          <div className="mt-5">
            <Tabs value={jobMode} onValueChange={(v) => setJobMode(v as "url" | "text")}>
              <TabsList>
                <TabsTrigger value="url">Paste job URL</TabsTrigger>
                <TabsTrigger value="text">Paste job text</TabsTrigger>
              </TabsList>
            </Tabs>
            {jobMode === "url" ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="job-url">Job posting URL</Label>
                <Input
                  id="job-url"
                  type="url"
                  placeholder="https://jobs.example.com/senior-frontend-engineer"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <Label htmlFor="job-text">Paste full job description</Label>
                <Textarea
                  id="job-text"
                  rows={10}
                  placeholder="We are hiring a Senior Frontend Engineer who…"
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <Button asChild variant="ghost"><Link href="/dashboard">Cancel</Link></Button>
            <Button onClick={analyzeJob} disabled={busy || (jobMode === "url" ? !jobUrl : jobText.length < 50)}>
              {busy ? "Analyzing…" : "Analyze role"}
            </Button>
          </div>
        </Card>
      )}

      {step === "details" && parsedJob && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Role summary</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{parsedJob.jobTitle}</strong>
              {parsedJob.company ? ` at ${parsedJob.company}` : ""}
              {parsedJob.location ? ` · ${parsedJob.location}` : ""}
              {parsedJob.yearsExperience ? ` · ${parsedJob.yearsExperience}+ yrs` : ""}
            </p>
            <div className="mt-3">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Required skills</h4>
              <div className="mt-1 flex flex-wrap gap-1">
                {parsedJob.requiredSkills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                {parsedJob.requiredSkills.length === 0 && <span className="text-xs text-muted-foreground">none detected</span>}
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Responsibilities</h4>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {parsedJob.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setStep("job")}>← Edit job</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">Your details</h2>
            <p className="text-sm text-muted-foreground">
              These go straight onto the CV header. Experience is generated for you.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={emailDetail} onChange={(e) => setEmailDetail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 555 1234" />
              </div>
              <div>
                <Label htmlFor="photo">Photo <span className="text-muted-foreground">(any image — we&apos;ll crop &amp; compress)</span></Label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    id="photo"
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                  {photoUrl ? (
                    <img src={photoUrl} alt="preview" className="size-16 rounded-md object-cover border" />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-md border text-xs text-muted-foreground">3:4</div>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {photo ? "Change" : "Upload"}
                  </Button>
                  {photo && <Button type="button" size="sm" variant="ghost" onClick={() => onPickFile(null)}>Remove</Button>}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={generateCv} disabled={busy}>
                {busy ? "Generating…" : "Generate CV →"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === "edit" && content && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review &amp; edit</h2>
            {issues.length > 0 && (
              <span className="text-xs text-amber-600">{issues.length} validation warnings — saved anyway</span>
            )}
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <Label>Summary</Label>
              <Textarea
                rows={3}
                value={content.summary}
                onChange={(e) => setContent((c) => (c ? { ...c, summary: e.target.value } : c))}
              />
            </div>
            {content.experience.map((e, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Title</Label>
                    <Input value={e.title} onChange={(ev) => patchExperience(i, { title: ev.target.value })} />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={e.company} onChange={(ev) => patchExperience(i, { company: ev.target.value })} />
                  </div>
                  <div>
                    <Label>Start</Label>
                    <Input value={e.startDate} onChange={(ev) => patchExperience(i, { startDate: ev.target.value })} placeholder="Mar 2021" />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input value={e.endDate} onChange={(ev) => patchExperience(i, { endDate: ev.target.value })} placeholder="Present" />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>Bullets (one per line)</Label>
                  <Textarea
                    rows={Math.max(3, e.bullets.length)}
                    value={e.bullets.join("\n")}
                    onChange={(ev) => {
                      const lines = ev.target.value.split("\n");
                      setContent((c) => {
                        if (!c) return c;
                        const exp = [...c.experience];
                        exp[i] = { ...exp[i], bullets: lines };
                        return { ...c, experience: exp };
                      });
                    }}
                  />
                </div>
              </div>
            ))}
            <div>
              <Label>Skills (comma-separated)</Label>
              <Input
                value={skillsValue.join(", ")}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep("details")} disabled={!jobId && !jobText}>
              ← Back
            </Button>
            <Button onClick={async () => {
              const ok = await saveEdits();
              if (!ok) return;
              setStep("style");
              setBusy(false);
            }}>
              Save &amp; style template →
            </Button>
          </div>
        </Card>
      )}

      {step === "style" && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_2fr]">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Template</h2>
            <div className="mt-3 space-y-2">
              {templates.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${templateId === t.id ? "border-primary ring-1 ring-primary" : ""}`}>
                  <input type="radio" name="template" className="mt-1" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <Label>Accent color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="size-10 cursor-pointer rounded-md border" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="max-w-32 font-mono" />
                </div>
              </div>
              <div>
                <Label>Font</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={fontId}
                  onChange={(e) => setFontId(e.target.value)}
                >
                  {(activeTemplate?.fonts ?? ["inter"]).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={refreshPdf} disabled={rendering} variant="outline">
                {rendering ? "Rendering…" : "Refresh preview"}
              </Button>
              <Button onClick={downloadPdf} disabled={rendering}>Download PDF</Button>
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="px-2 py-2 text-sm font-medium text-muted-foreground">PDF preview</h2>
            <div className="aspect-[210/297] w-full overflow-hidden rounded-md border bg-muted/30">
              {pdfUrl ? (
                <iframe src={pdfUrl} className="h-full w-full" title="CV preview" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Click <em>Refresh preview</em> to render.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
};

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["job", "details", "edit", "style"];
  const labels: Record<Step, string> = { job: "Job", details: "Details", edit: "Edit", style: "Style" };
  const idx = order.indexOf(step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`grid size-6 place-items-center rounded-full border ${i <= idx ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {i + 1}
          </span>
          <span className={i === idx ? "font-medium text-foreground" : "text-muted-foreground"}>{labels[s]}</span>
          {i < order.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export default NewPage;