"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  Palette,
  ImageIcon,
  FileText,
  PencilLine,
  Check,
  Play,
  Link2,
  Wand2,
  Download,
  ArrowRight,
} from "lucide-react";

const features = [
  { icon: Link2, title: "Parses any job posting", desc: "Drop a URL or paste the text. We extract skills, requirements, and keywords automatically." },
  { icon: Wand2, title: "AI-tailored content", desc: "Realistic, role-specific experience written for any industry — not just tech." },
  { icon: Palette, title: "13 beautiful templates", desc: "Modern, Classic, Minimal, Elegant, Dark, Timeline, Magenta and more — each with customizable colors and fonts." },
  { icon: ImageIcon, title: "Photo upload", desc: "Upload any photo. We crop to 3:4, compress, and embed it in your CV automatically." },
  { icon: FileText, title: "PDF in one click", desc: "Pixel-perfect A4 PDF rendered server-side. Download or preview instantly." },
  { icon: PencilLine, title: "Edit before download", desc: "AI writes the draft. You tweak the summary, experience, skills, and style before exporting." },
];

const steps = [
  { n: "01", icon: Link2, titleKey: "home.how.step1", descKey: "home.how.desc1" },
  { n: "02", icon: Wand2, titleKey: "home.how.step2", descKey: "home.how.desc2" },
  { n: "03", icon: Download, titleKey: "home.how.step3", descKey: "home.how.desc3" },
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.user))
      .catch(() => {});
  }, []);

  // GSAP entrance + scroll reveals
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !rootRef.current) return;

        // Hero entrance timeline
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(".hero-badge", { y: 12, opacity: 0, duration: 0.4 })
          .from(".hero-char", { y: 30, opacity: 0, duration: 0.5, stagger: 0.015 }, "-=0.2")
          .from(".hero-sub", { y: 20, opacity: 0, duration: 0.4 }, "-=0.3")
          .from(".hero-cta", { y: 16, opacity: 0, duration: 0.35, stagger: 0.08 }, "-=0.25")
          .from(".hero-badge-row > *", { y: 10, opacity: 0, duration: 0.3, stagger: 0.05 }, "-=0.2");

        // Parallax blobs
        gsap.to(".blob-a", { yPercent: -30, scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });
        gsap.to(".blob-b", { yPercent: 40, scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });

        // Scroll-reveal cards (batch)
        ScrollTrigger.batch(".reveal-card", {
          start: "top 85%",
          onEnter: (els) => gsap.fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "power2.out" }),
          once: true,
        });

        // Section headings
        gsap.utils.toArray<HTMLElement>(".section-head").forEach((el) => {
          gsap.from(el, { y: 24, opacity: 0, duration: 0.5, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
        });

        // CTA section entrance
        gsap.from(".cta-fade", { y: 30, opacity: 0, duration: 0.5, scrollTrigger: { trigger: ".cta-section", start: "top 80%", once: true } });

        cleanup = () => { ScrollTrigger.getAll().forEach((st) => st.kill()); gsap.killTweensOf("*"); };
      } catch {}
    })();
    return () => cleanup();
  }, []);

  // Hero char split helper
  const heroTitle = "Paste a job. Get a tailored CV. In seconds.";
  const heroChars = heroTitle.split("");

  return (
    <div ref={rootRef} className="overflow-x-hidden">
      {/* HERO */}
      <section className="hero relative overflow-hidden px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="blob-a absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px] sm:h-[700px] sm:w-[700px]" />
          <div className="blob-b absolute -bottom-40 right-0 h-[350px] w-[350px] rounded-full bg-accent/8 blur-[100px] sm:h-[500px] sm:w-[500px]" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("home.hero.badge")}
          </div>
          <h1
            className="text-balance font-bold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 7vw, 4rem)", lineHeight: 1.1 }}
            aria-label={heroTitle}
          >
            {heroChars.map((ch, i) => (
              <span key={i} className="hero-char inline-block" aria-hidden="true">
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </h1>
          <p className="hero-sub mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            {t("home.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Button asChild size="lg" className="hero-cta rounded-full px-8">
                <Link href="/dashboard">{t("home.hero.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="hero-cta rounded-full px-8">
                  <Link href="/login">{t("home.hero.signin")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="hero-cta rounded-full px-8">
                  <Link href="/new">{t("home.hero.try")}</Link>
                </Button>
              </>
            )}
          </div>
          <div className="hero-badge-row mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-500" />
              {t("home.hero.nocc")}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-500" />
              {t("home.hero.free")}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-500" />
              {t("home.hero.nosignup")}
            </span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="section-head mx-auto mb-12 max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}>
              {t("home.how.title")}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="reveal-card group relative rounded-2xl border border-border/50 bg-card/40 p-6 transition-colors duration-200 hover:border-primary/30"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <span className="font-bold text-muted-foreground/40">{s.n}</span>
                </div>
                <h3 className="mb-2 text-base font-semibold">{t(s.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="section-head mx-auto mb-12 max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Features</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}>
              {t("home.features.title")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{t("home.features.subtitle")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="reveal-card group rounded-2xl border border-border/50 bg-card/40 p-6 transition-colors duration-200 hover:border-primary/30"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section relative overflow-hidden px-6 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-40 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-primary/6 blur-[120px]" />
          <div className="absolute -right-40 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-accent/6 blur-[120px]" />
        </div>
        <div className="cta-fade mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Play className="size-7" />
          </div>
          <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}>
            {t("home.cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
            {t("home.cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/dashboard">{t("home.cta.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="rounded-full px-8">
                  <Link href="/login">{t("home.cta.start")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                  <Link href="/new">
                    {t("home.cta.try")}
                    <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}