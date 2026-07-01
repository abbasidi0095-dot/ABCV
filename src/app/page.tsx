"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const features = [
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    titleKey: "Parses any job posting",
    descKey: "Drop a URL or paste the text. We extract skills, requirements, and keywords automatically.",
  },
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    titleKey: "AI-tailored content",
    descKey: "Realistic, role-specific experience. Every CV is unique.",
  },
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    titleKey: "6 beautiful templates",
    descKey: "Modern, Classic, Minimal, Elegant, Compact, Creative — each with customizable colors and fonts.",
  },
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    titleKey: "Photo → base64",
    descKey: "Upload any photo. We crop to 3:4, compress under 200KB, and store as base64.",
  },
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    titleKey: "PDF in one click",
    descKey: "Handlebars + Puppeteer renders a pixel-perfect A4 PDF. Download or preview instantly.",
  },
  {
    icon: (
      <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    titleKey: "Edit before download",
    descKey: "AI writes the draft. You tweak the summary, experience, skills, and style before exporting.",
  },
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.user))
      .catch(() => {});
  }, []);
  return (
    <>
      <section className="relative overflow-hidden px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("home.hero.badge")}
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Paste a job.{<br className="sm:hidden" />} Get a tailored CV.{<br />}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              In seconds.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("home.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                <Link href="/dashboard">{t("home.hero.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                  <Link href="/login">{t("home.hero.signin")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                  <Link href="/new">{t("home.hero.try")}</Link>
                </Button>
              </>
            )}
          </div>
          <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {t("home.hero.nocc")}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {t("home.hero.free")}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {t("home.hero.nosignup")}
            </span>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{t("home.how.title").split(" ")[0].toLowerCase() === "three" ? "How it works" : "How it works"}</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.how.title")}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { n: "01", titleKey: "home.how.step1", descKey: "home.how.desc1" },
              { n: "02", titleKey: "home.how.step2", descKey: "home.how.desc2" },
              { n: "03", titleKey: "home.how.step3", descKey: "home.how.desc3" },
            ].map((s) => (
              <div key={s.n} className="group relative rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-md">
                  {s.n}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(s.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{t("home.features.title").split(" ")[0] === "Everything" ? "Features" : "Features"}</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.features.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("home.features.subtitle")}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.titleKey} className="group rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold">{f.titleKey}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.descKey}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute -right-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-accent/8 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
            <svg className="size-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            {t("home.cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                <Link href="/dashboard">{t("home.cta.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                  <Link href="/login">{t("home.cta.start")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                  <Link href="/new">{t("home.cta.try")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
