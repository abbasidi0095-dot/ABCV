import Handlebars from "handlebars";
import path from "node:path";
import { promises as fs } from "node:fs";
import puppeteer from "puppeteer";
import { TemplateMetaSchema, type TemplateMeta, type CVContent, CVContentSchema } from "@/lib/schemas";
import { LEVEL_LABELS, UI_LABELS } from "@/lib/languages";


const TEMPLATES_DIR = path.join(process.cwd(), "templates");

/** Chromium launch flags tuned to work in containerized environments (Docker/Render). */
const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--no-zygote",
  "--font-render-hinting=none",
];

/** A writable user-data dir so Chromium's crashpad handler gets a valid database path. */
const USER_DATA_DIR = process.env.PUPPETEER_USER_DATA_DIR || "/tmp/abcv-puppeteer-ud";

export async function listTemplates(): Promise<TemplateMeta[]> {
  const dirs = await fs.readdir(TEMPLATES_DIR);
  const out: TemplateMeta[] = [];
  for (const d of dirs) {
    const metaPath = path.join(TEMPLATES_DIR, d, "meta.json");
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      const meta = TemplateMetaSchema.parse(JSON.parse(raw));
      out.push(meta);
    } catch {
      /* skip invalid template folders */
    }
  }
  return out;
}

export async function getTemplate(id: string): Promise<TemplateMeta | null> {
  const all = await listTemplates();
  return all.find((t) => t.id === id) ?? null;
}

export interface RenderArgs {
  templateId: string;
  accentColor: string;
  fontId: string;
  fullName: string;
  email: string;
  phone: string;
  photoBase64?: string | null;
  roleTitle?: string | null;
  content: CVContent;
  language?: string;
}

/** Render the template HTML and PDF bytes. */
export async function renderCvPdf(args: RenderArgs): Promise<Buffer> {
  const dirs = path.join(TEMPLATES_DIR, args.templateId);
  const files = await fs.readdir(dirs).catch(() => null);
  if (!files) throw new Error(`Template "${args.templateId}" not found`);

  const templateSrc = await fs.readFile(path.join(dirs, "template.hbs"), "utf-8");
  const tpl = Handlebars.compile(templateSrc);
  const photoB64 = args.photoBase64 ?? null;
  const initials = args.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const expCount = args.content.experience.length;
  const fontScale = expCount <= 3 ? 1 : expCount <= 5 ? 0.86 : 0.76;
  const lang = args.language ?? "en";
  const levelLabels = (LEVEL_LABELS as Record<string, { high: string; medium: string }>)[lang] ?? LEVEL_LABELS.en;
  const uiLabels = (UI_LABELS as Record<string, { languages: string; skills: string; experience: string; contact: string; summary: string }>)[lang] ?? UI_LABELS.en;

  const html = tpl({
    accentColor: args.accentColor,
    fontId: args.fontId,
    fontScale,
    fullName: args.fullName,
    email: args.email,
    phone: args.phone,
    photoB64,
    initials,
    roleTitle: args.roleTitle,
    content: args.content,
    levelLabels,
    uiLabels,
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    userDataDir: USER_DATA_DIR,
    args: CHROMIUM_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Cover letter render */
export interface CoverLetterArgs {
  fullName: string;
  email: string;
  phone: string;
  roleTitle?: string | null;
  body: string;
}

export async function renderCoverLetterPdf(args: CoverLetterArgs): Promise<Buffer> {
  const initials = args.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page { margin: 22mm 25mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; font-size: 11pt; line-height: 1.6; }
  .header { margin-bottom: 28px; }
  .header h1 { font-size: 18pt; font-weight: 700; color: #111827; }
  .contact { font-size: 10pt; color: #6b7280; margin-top: 2px; }
  .date { margin-bottom: 20px; color: #6b7280; font-size: 10pt; }
  .salutation { margin-bottom: 14px; }
  .body p { margin-bottom: 12px; }
  .closing { margin-top: 22px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${args.fullName}</h1>
    <div class="contact">${args.email} &middot; ${args.phone}</div>
  </div>
  <div class="date">${dateStr}</div>
  <div class="salutation">Dear Hiring Manager,</div>
  <div class="body">
    ${args.body.split("\n\n").map((p) => `<p>${p.trim()}</p>`).join("\n    ")}
  </div>
  <div class="closing">
    <p>Sincerely,</p>
    <p><strong>${args.fullName}</strong></p>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    userDataDir: USER_DATA_DIR,
    args: CHROMIUM_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// Re-export for routes
export { CVContentSchema };