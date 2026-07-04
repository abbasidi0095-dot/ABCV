const fetch = require('node-fetch');

async function test() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const user = await prisma.user.findFirst();
    const cv = await prisma.cv.findFirst({ where: { userId: user.id } });
    await prisma.$disconnect();

    console.log("Testing POST to API for CV:", cv.id);
    
    // We can't use the API easily because of auth, but we can look at the server logs again 
    // Or we can modify the API temporarily to not require auth for testing
  } catch (e) {
    console.error(e);
  }
}
test();
