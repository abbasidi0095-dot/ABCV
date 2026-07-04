const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    const cv = await prisma.cv.findFirst({ where: { userId: user?.id } });
    if (!cv) return console.log("No CV");

    console.log("Testing POST to API for CV:", cv.id);
    
    // We'll use 127.0.0.1 which is safer than localhost for Node.js fetch
    const response = await fetch(`http://127.0.0.1:3000/api/cvs/${cv.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: "modern", accentColor: "#2563eb", fontId: "inter" })
    });
    
    console.log("Status:", response.status);
    if (!response.ok) {
      const text = await response.text();
      console.log("Error:", text);
    } else {
      console.log("Success! Got PDF bytes:", (await response.arrayBuffer()).byteLength);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    // Kill the next server
    const fs = require('fs');
    try {
      const pid = fs.readFileSync('/tmp/next.pid', 'utf8').trim();
      process.kill(pid);
    } catch(err) {}
  }
}
test();
