#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const action = process.argv[3] || 'upgrade';

  if (!email) {
    console.error('Usage: node set-pro.js <email> [upgrade|downgrade]');
    process.exit(1);
  }

  const isPro = action === 'upgrade';

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { isPro },
    });
    console.log(`Successfully set isPro=${isPro} for ${user.email}`);
  } catch (e) {
    if (e.code === 'P2025') {
      console.error(`User with email ${email} not found.`);
    } else {
      console.error('Error:', e);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
