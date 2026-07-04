const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log("No user");
    const cv = await prisma.cv.findFirst({ where: { userId: user.id } });
    if (!cv) return console.log("No CV");

    // We can simulate the POST endpoint directly by passing the CV data to renderCvPdf
    const { renderCvPdf } = require('./.next/server/app/api/cvs/[id]/route.js');
    console.log("Found CV. Template:", cv.templateId);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
