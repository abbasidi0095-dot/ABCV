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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepTransition } from "@/components/step-transition";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, RefreshCw, Download, Loader2, ChevronDown } from "lucide-react";

type Step = "job" | "details" | "edit" | "style";

interface ParsedJob {
  jobTitle: string; company?: string | null; location?: string | null;
  requiredSkills: string[]; responsibilities: string[]; yearsExperience?: number | null; keywords: string[];
}
interface ExperienceEntry {
  company: string; title: string; startDate: string; endDate: string; bullets: string[];
}
interface CVContent {
  summary: string; experience: ExperienceEntry[]; skills: string[]; languages?: { name: string; level: "high" | "medium" }[];
}
interface CvResponse {
  id: string; fullName: string; email: string; phone: string;
  templateId: string; accentColor: string; fontId: string; contentJson: CVContent;
}
interface TemplateMeta {
  id: string; name: string; description: string; accentDefault: string; fonts: string[];
}

const ACCENT_SWATCHES = ["#2563eb", "#7c3aed", "#dc2626", "#059669", "#d946ef", "#ea580c", "#0d9488", "#475569"];

const NewPage: NextPage = () => (
  <Suspense fallback={<main className="mx-auto max-w-4xl flex-1 px-4 py-10 text-sm text-muted-foreground">Loading…</main>}>
    <NewPageInner />
  </Suspense>
);

const NewPageInner = () => {
  const { t } = useI18n();
  const params = useSearchParams();
  const editId = params.get("cv");

  const [step, setStep] = useState<Step>("job");
  const [busy, setBusy] = useState(Boolean(editId));
  const [prevStep, setPrevStep] = useState<Step>("job");

  // Step 1: job
  const [jobMode, setJobMode] = useState<"url" | "text">("text");
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
  const [language, setLanguage] = useState("en");
  const [numExperiences, setNumExperiences] = useState(3);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3/4
  const [cvId, setCvId] = useState<string | null>(null);
  const [content, setContent] = useState<CVContent | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [templateId, setTemplateId] = useState("modern");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [fontId, setFontId] = useState("inter");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const [coverLetterBody, setCoverLetterBody] = useState<string | null>(null);
  const [coverLetterBusy, setCoverLetterBusy] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const goStep = (s: Step) => { setPrevStep(step); setStep(s); };
  const direction = (() => {
    const order: Step[] = ["job", "details", "edit", "style"];
    return order.indexOf(step) >= order.indexOf(prevStep) ? 1 : -1;
  })();

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/cvs/${editId}`)
      .then((r) => r.json())
      .then((d) => {
        const cv = d.cv as CvResponse;
        setCvId(cv.id); setFullName(cv.fullName); setEmailDetail(cv.email); setPhone(cv.phone);
        setContent(cv.contentJson); setTemplateId(cv.templateId); setAccentColor(cv.accentColor); setFontId(cv.fontId);
        setStep("edit");
      })
      .catch(() => toast.error("Failed to load CV"))
      .finally(() => setBusy(false));
  }, [editId]);

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((d) => setTemplates(d.templates)).catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "style" || !cvId) return;
    const tm = setTimeout(() => void refreshPdf(), 400);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cvId, templateId, accentColor, fontId]);

  const onPickFile = (f: File | null) => {
    if (!f) { setPhoto(null); setPhotoUrl(null); return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(f); setPhotoUrl(URL.createObjectURL(f));
  };

  const analyzeJob = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobMode === "url" ? { sourceUrl: jobUrl } : { pastedText: jobText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? d.error ?? "Failed");
      setJobId(d.job.id); setParsedJob(d.job.parsedJson as ParsedJob);
      goStep("details"); toast.success(t("new.toast.analyzed"));
    } catch (e) { toast.error("Analyze failed", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const generateCv = async () => {
    if (!fullName || !emailDetail || !phone) { toast.error("All fields are required"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (jobId) fd.set("jobId", jobId);
      if (jobText && !jobId) fd.set("pastedText", jobText);
      fd.set("fullName", fullName); fd.set("email", emailDetail); fd.set("phone", phone);
      fd.set("language", language); fd.set("numExperiences", String(numExperiences));
      if (photo) fd.set("photo", photo);
      const r = await fetch("/api/cvs", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? d.error ?? "Failed");
      setCvId(d.cv.id); setContent(d.cv.contentJson as CVContent); setIssues(d.issues ?? []);
      goStep("edit"); toast.success(t("new.toast.generated"));
    } catch (e) { toast.error("Generation failed", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const saveEdits = async (): Promise<boolean> => {
    if (!cvId || !content) return false;
    const r = await fetch(`/api/cvs/${cvId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email: emailDetail, phone, content }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(t("new.toast.save_failed"), { description: d.detail ?? "" }); return false; }
    return true;
  };

  async function refreshPdf() {
    if (!cvId) return;
    setRendering(true);
    try {
      const ok = await saveEdits(); if (!ok) return;
      const r = await fetch(`/api/cvs/${cvId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accentColor, fontId }),
      });
      if (!r.ok) throw new Error("Render failed");
      const blob = await r.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) { toast.error("Preview failed", { description: (e as Error).message }); }
    finally { setRendering(false); }
  }

  const downloadPdf = async () => {
    if (!cvId) return;
    try {
      const r = await fetch(`/api/cvs/${cvId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accentColor, fontId }),
      });
      if (!r.ok) throw new Error("Render failed");
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${fullName.replace(/\s+/g, "_")}_CV.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error("Download failed", { description: (e as Error).message }); }
  };

  const patchExperience = (i: number, patch: Partial<ExperienceEntry>) => {
    setContent((c) => { if (!c) return c; const exp = [...c.experience]; exp[i] = { ...exp[i], ...patch }; return { ...c, experience: exp }; });
  };
  const addExperience = () => {
    setContent((c) => c ? { ...c, experience: [...c.experience, { company: "", title: "", startDate: "", endDate: "", bullets: [""] }] } : c);
  };
  const removeExperience = (i: number) => {
    setContent((c) => c ? { ...c, experience: c.experience.filter((_, idx) => idx !== i) } : c);
  };
  const setSkills = (csv: string) => {
    const arr = csv.split(",").map((s) => s.trim()).filter(Boolean);
    setContent((c) => c ? { ...c, skills: arr } : c);
  };

  const generateCoverLetter = async () => {
    if (!cvId) return; setCoverLetterBusy(true);
    try {
      const r = await fetch(`/api/cvs/${cvId}/cover-letter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      if (!r.ok) throw new Error("Generation failed");
      const d = await r.json(); setCoverLetterBody(d.body); toast.success("Cover letter generated");
    } catch (e) { toast.error("Cover letter failed", { description: (e as Error).message }); }
    finally { setCoverLetterBusy(false); }
  };

  const downloadCoverLetter = async () => {
    if (!cvId || !coverLetterBody) return;
    try {
      const r = await fetch(`/api/cvs/${cvId}/cover-letter?download=true`);
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${fullName.replace(/\s+/g, "_")}_Cover_Letter.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error("Download failed", { description: (e as Error).message }); }
  };

  const activeTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Stepper step={step} />

      <StepTransition stepKey={step} direction={direction}>
        {step === "job" && (
          <Card className="mt-5 rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Tell us about the role</h2>
            <p className="text-sm text-muted-foreground">We&apos;ll extract required skills, responsibilities, and keywords, then tailor a CV to match.</p>
            <div className="mt-5">
              <Tabs value={jobMode} onValueChange={(v) => setJobMode(v as "url" | "text")}>
                <TabsList className="w-full">
                  <TabsTrigger value="text" className="flex-1">Paste job text</TabsTrigger>
                  <TabsTrigger value="url" className="flex-1">Paste job URL</TabsTrigger>
                </TabsList>
              </Tabs>
              {jobMode === "url" ? (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="job-url">Job posting URL</Label>
                  <Input id="job-url" type="url" inputMode="url" placeholder="https://jobs.example.com/senior-engineer" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
                </div>
              ) : (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="job-text">Paste full job description</Label>
                  <Textarea id="job-text" rows={8} placeholder="We are hiring a Senior Engineer who…" value={jobText} onChange={(e) => setJobText(e.target.value)} />
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <Button asChild variant="ghost"><Link href="/dashboard"><ArrowLeft className="size-4" />{t("new.job.cancel")}</Link></Button>
              <Button onClick={analyzeJob} disabled={busy || (jobMode === "url" ? !jobUrl : jobText.length < 50)}>
                {busy ? <><Loader2 className="size-4 animate-spin" />{t("new.job.analyzing")}</> : <>{t("new.job.analyze")}<ArrowRight className="size-4" /></>}
              </Button>
            </div>
          </Card>
        )}

        {step === "details" && parsedJob && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-lg font-semibold">Role summary</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong className="text-foreground">{parsedJob.jobTitle}</strong>
                {parsedJob.company ? ` at ${parsedJob.company}` : ""}
                {parsedJob.location ? ` · ${parsedJob.location}` : ""}
                {parsedJob.yearsExperience ? ` · ${parsedJob.yearsExperience}+ yrs` : ""}
              </p>
              <div className="mt-3">
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground">{t("new.role.skills")}</h4>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {parsedJob.requiredSkills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  {parsedJob.requiredSkills.length === 0 && <span className="text-xs text-muted-foreground">{t("new.role.none")}</span>}
                </div>
              </div>
              <div className="mt-3">
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground">{t("new.role.responsibilities")}</h4>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {parsedJob.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => goStep("job")}><ArrowLeft className="size-4" />{t("new.role.edit")}</Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold">{t("new.details.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("new.details.subtitle")}</p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">{t("new.details.fullname")}</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" inputMode="email" value={emailDetail} onChange={(e) => setEmailDetail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t("new.details.phone")}</Label>
                  <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("new.details.language")}</Label>
                  <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("new.details.numExperiences")}</Label>
                  <Select value={String(numExperiences)} onValueChange={(v) => v && setNumExperiences(parseInt(v, 10))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="photo">{t("new.details.photo")} <span className="text-muted-foreground">({t("new.details.photo.hint")})</span></Label>
                  <div className="flex items-center gap-3">
                    <input ref={fileInputRef} id="photo" type="file" accept="image/*" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="preview" className="size-16 rounded-md object-cover border" />
                    ) : (
                      <div className="grid size-16 place-items-center rounded-md border text-xs text-muted-foreground">3:4</div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      {photo ? t("new.details.change") : t("new.details.upload")}
                    </Button>
                    {photo && <Button type="button" size="sm" variant="ghost" onClick={() => onPickFile(null)}>{t("new.details.remove")}</Button>}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={generateCv} disabled={busy} className="w-full sm:w-auto">
                  {busy ? <><Loader2 className="size-4 animate-spin" />{t("new.details.generating")}</> : <>{t("new.details.generate")}<ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {step === "edit" && content && (
          <Card className="mt-5 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("new.edit.title")}</h2>
              {issues.length > 0 && (
                <span className="text-xs text-amber-600">{issues.length} validation warnings — saved anyway</span>
              )}
            </div>
            <div className="mt-5 space-y-5">
              <div className="space-y-1.5">
                <Label>{t("new.edit.summary")}</Label>
                <Textarea rows={3} value={content.summary} onChange={(e) => setContent((c) => c ? { ...c, summary: e.target.value } : c)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Experience</Label>
                <Button type="button" size="sm" variant="outline" onClick={addExperience}><Plus className="size-4" />{t("new.edit.add")}</Button>
              </div>
              {content.experience.map((e, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeExperience(i)}>
                      <Trash2 className="size-3.5" />{t("new.edit.remove")}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("new.edit.title.label")}</Label>
                      <Input value={e.title} onChange={(ev) => patchExperience(i, { title: ev.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("new.edit.company")}</Label>
                      <Input value={e.company} onChange={(ev) => patchExperience(i, { company: ev.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("new.edit.start")}</Label>
                      <Input value={e.startDate} onChange={(ev) => patchExperience(i, { startDate: ev.target.value })} placeholder="Mar 2021" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("new.edit.end")}</Label>
                      <Input value={e.endDate} onChange={(ev) => patchExperience(i, { endDate: ev.target.value })} placeholder="Present" />
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Label className="text-xs">{t("new.edit.bullets")}</Label>
                    <Textarea rows={Math.max(3, e.bullets.length)} value={e.bullets.join("\n")} onChange={(ev) => {
                      const lines = ev.target.value.split("\n");
                      setContent((c) => { if (!c) return c; const exp = [...c.experience]; exp[i] = { ...exp[i], bullets: lines }; return { ...c, experience: exp }; });
                    }} />
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>{t("new.edit.skills")}</Label>
                <Input value={(content.skills ?? []).join(", ")} onChange={(e) => setSkills(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => goStep("details")} disabled={!jobId && !jobText}><ArrowLeft className="size-4" />{t("new.edit.back")}</Button>
              <Button onClick={async () => { if (await saveEdits()) { goStep("style"); setBusy(false); } }}>
                {t("new.edit.save")}<ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}

        {step === "style" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <Card className="p-5">
              <h2 className="text-lg font-semibold">{t("new.style.title")}</h2>

              {/* Template dropdown */}
              <div className="mt-3 space-y-1.5">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={(v) => v && setTemplateId(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {templates.map((tm) => (
                      <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeTemplate && <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>}
              </div>

              {/* Accent color — swatch grid + custom */}
              <div className="mt-4 space-y-1.5">
                <Label>{t("new.style.accent")}</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c} type="button" onClick={() => setAccentColor(c)}
                      className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${accentColor === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                  <label className="relative size-8 cursor-pointer rounded-full border-2 border-dashed border-border overflow-hidden" style={{ background: accentColor }}>
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                  </label>
                </div>
              </div>

              {/* Font dropdown */}
              <div className="mt-4 space-y-1.5">
                <Label>{t("new.style.font")}</Label>
                <Select value={fontId} onValueChange={(v) => v && setFontId(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(activeTemplate?.fonts ?? ["inter"]).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={refreshPdf} disabled={rendering} variant="outline" className="w-full">
                  {rendering ? <><Loader2 className="size-4 animate-spin" />{t("new.style.rendering")}</> : <><RefreshCw className="size-4" />{t("new.style.refresh")}</>}
                </Button>
                <Button onClick={downloadPdf} disabled={rendering} className="w-full">
                  <Download className="size-4" />{t("new.style.download")}
                </Button>
              </div>

              {/* Cover letter collapsible */}
              <button type="button" onClick={() => setCoverOpen((v) => !v)} className="mt-5 flex w-full items-center justify-between text-sm font-semibold">
                {t("new.cover.title")}
                <ChevronDown className={`size-4 transition-transform ${coverOpen ? "rotate-180" : ""}`} />
              </button>
              {coverOpen && (
                <div className="mt-3 space-y-3">
                  {!coverLetterBody ? (
                    <Button onClick={generateCoverLetter} disabled={coverLetterBusy} variant="outline" className="w-full">
                      {coverLetterBusy ? <><Loader2 className="size-4 animate-spin" />{t("new.cover.generating")}</> : t("new.cover.generate")}
                    </Button>
                  ) : (
                    <>
                      <Textarea rows={6} value={coverLetterBody} onChange={(e) => setCoverLetterBody(e.target.value)} className="text-xs" />
                      <div className="flex gap-2">
                        <Button onClick={generateCoverLetter} disabled={coverLetterBusy} variant="outline" size="sm" className="flex-1">
                          {coverLetterBusy ? t("new.cover.generating") : t("new.cover.regenerate")}
                        </Button>
                        <Button onClick={downloadCoverLetter} size="sm" className="flex-1">{t("new.cover.download")}</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* PDF preview */}
            <Card className="p-3">
              <h2 className="px-2 py-2 text-sm font-medium text-muted-foreground">{t("new.style.preview")}</h2>
              <div className="aspect-[210/297] w-full overflow-hidden rounded-md border bg-muted/30">
                {pdfUrl ? (
                  <iframe src={pdfUrl} className="h-full w-full" title="CV preview" />
                ) : rendering ? (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    <><Loader2 className="size-5 animate-spin" /> {t("new.style.rendering")}</>
                  </div>
                ) : (
                  <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
                    {t("new.style.preview.empty")}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </StepTransition>
    </main>
  );
};

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["job", "details", "edit", "style"];
  const labels: Record<Step, string> = { job: "Job", details: "Details", edit: "Edit", style: "Style" };
  const idx = order.indexOf(step);
  return (
    <ol className="flex items-center gap-1 text-xs sm:gap-2">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-1 sm:gap-2">
          <span className={`grid size-6 place-items-center rounded-full border text-[10px] sm:text-xs transition-colors ${i <= idx ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {i + 1}
          </span>
          <span className={`${i === idx ? "font-medium text-foreground" : "hidden text-muted-foreground sm:inline"}`}>{labels[s]}</span>
          {i < order.length - 1 && <span className="h-px w-4 bg-border sm:w-6" />}
        </li>
      ))}
    </ol>
  );
}

export default NewPage;