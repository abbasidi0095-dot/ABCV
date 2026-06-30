import Handlebars from "handlebars";
import path from "node:path";
import { promises as fs } from "node:fs";
import puppeteer from "puppeteer";
import { TemplateMetaSchema, type TemplateMeta, type CVContent, CVContentSchema } from "@/lib/schemas";


const TEMPLATES_DIR = path.join(process.cwd(), "templates");

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

  const html = tpl({
    accentColor: args.accentColor,
    fontId: args.fontId,
    fullName: args.fullName,
    email: args.email,
    phone: args.phone,
    photoB64,
    initials,
    roleTitle: args.roleTitle,
    content: args.content,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
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

// Re-export for routes
export { CVContentSchema };