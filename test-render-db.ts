import { PrismaClient } from '@prisma/client';
import { renderCvPdf } from './src/lib/pdf';
import { CVContentSchema } from './src/lib/schemas';

const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log("No user");
    const cv = await prisma.cv.findFirst({ where: { userId: user.id } });
    if (!cv) return console.log("No CV");

    console.log("Found CV, testing renderCvPdf...");
    
    let content;
    try { 
      content = CVContentSchema.parse(cv.contentJson); 
    } catch (e: any) {
      console.warn("Content parse failed, using raw:", e.message);
      content = cv.contentJson as any;
    }

    const pdf = await renderCvPdf({
      templateId: cv.templateId || "modern",
      accentColor: cv.accentColor || "#2563eb",
      fontId: cv.fontId || "inter",
      fullName: cv.fullName,
      email: cv.email,
      phone: cv.phone,
      photoBase64: cv.photoBase64,
      roleTitle: "Test Role",
      content: content,
      language: cv.language || "en",
      isPro: user.isPro,
    });
    
    console.log("Successfully generated PDF of size:", pdf.length);
  } catch (e: any) {
    console.error("Render failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
