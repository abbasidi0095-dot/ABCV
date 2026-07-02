import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CVContentSchema, RenderInputSchema, type CVContent } from "@/lib/schemas";
import { renderCvPdf } from "@/lib/pdf";
import { JobParsedSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const cv = await prisma.cv.findUnique({ where: { id, userId: user.id } });
  if (!cv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ cv });
}

const PatchSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  content: CVContentSchema.optional(),
  templateId: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontId: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  let body;
  try { body = PatchSchema.parse(await req.json()); } catch (e) {
    return NextResponse.json({ error: "invalid body", detail: String(e) }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (body.fullName) data.fullName = body.fullName;
  if (body.email) data.email = body.email;
  if (body.phone) data.phone = body.phone;
  if (body.content) data.contentJson = body.content;
  if (body.templateId) data.templateId = body.templateId;
  if (body.accentColor) data.accentColor = body.accentColor;
  if (body.fontId) data.fontId = body.fontId;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "no fields to update" }, { status: 400 });

  const cv = await prisma.cv.updateMany({ where: { id, userId: user.id }, data });
  if (cv.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, updated: cv.count });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const r = await prisma.cv.deleteMany({ where: { id, userId: user.id } });
  if (r.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** POST /api/cvs/[id]/render -> streams a PDF. Body uses RenderInputSchema. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return unauthorized(); }
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  // POST may carry style overrides (templateId, accentColor, fontId);
  // accept empty body to use the stored defaults.
  let style = RenderInputSchema.parse({});
  try {
    const j = await req.json();
    if (j && typeof j === "object") style = RenderInputSchema.parse(j);
  } catch {
    /* fall back to defaults */
  }

  const cv = await prisma.cv.findUnique({ where: { id, userId: user.id }, include: { job: true } });
  if (!cv) return NextResponse.json({ error: "not found" }, { status: 404 });

  let roleTitle: string | null = null;
  if (cv.job) {
    try { roleTitle = JobParsedSchema.parse(cv.job.parsedJson).jobTitle; } catch { /* ignore */ }
  }

  let content;
  try { content = CVContentSchema.parse(cv.contentJson); } catch (e) {
    // Defensive: if stored content fails strict parsing (e.g., localised dates
    // the LLM emitted despite the prompt), fall back to the raw stored object
    // rather than returning 500 so the user still gets a PDF.
    console.warn("Render route: content parse failed, using raw stored JSON:", (e as Error).message);
    content = cv.contentJson as CVContent;
  }

  let pdf: Buffer;
  try {
    pdf = await renderCvPdf({
      templateId: style.templateId || cv.templateId,
      accentColor: style.accentColor || cv.accentColor,
      fontId: style.fontId || cv.fontId,
      fullName: cv.fullName,
      email: cv.email,
      phone: cv.phone,
      photoBase64: cv.photoBase64,
      roleTitle,
      content,
      language: cv.language || "en",
    });
  } catch (e) {
    return NextResponse.json({ error: "render_failed", detail: (e as Error).message }, { status: 500 });
  }

  // Persist the override style choices back to the CV.
  await prisma.cv.updateMany({
    where: { id, userId: user.id },
    data: {
      templateId: style.templateId || cv.templateId,
      accentColor: style.accentColor || cv.accentColor,
      fontId: style.fontId || cv.fontId,
    },
  });

  const safeName = cv.fullName.replace(/[^a-z0-9]+/gi, "_");
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${safeName}_CV.pdf"`,
      "content-length": String(pdf.byteLength),
    },
  });
}