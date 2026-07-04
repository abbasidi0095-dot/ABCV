const fetch = require('node-fetch');
// Using the existing user and cv from DB 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("No users found");
      return;
    }
    
    let cv = await prisma.cv.findFirst({ where: { userId: user.id } });
    if (!cv) {
      // Create a dummy CV to test rendering
      cv = await prisma.cv.create({
        data: {
          userId: user.id,
          fullName: "Test User",
          email: "test@example.com",
          phone: "123456",
          contentJson: {
            summary: "Test summary",
            experience: [],
            skills: ["Testing"]
          }
        }
      });
      console.log("Created test CV:", cv.id);
    }
    
    console.log("Testing render API for CV:", cv.id);
    
    // We can't easily mock the session for the API, so let's import the function and test it directly
    const { renderCvPdf } = require('./.next/server/app/api/cvs/[id]/route.js');
    // The compiled file might be hard to access, let's just use ts-node
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
