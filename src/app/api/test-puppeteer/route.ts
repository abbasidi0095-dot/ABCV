import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET() {
  try {
    console.log("Testing puppeteer launch inside Next.js...");
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const version = await browser.version();
    await browser.close();
    return NextResponse.json({ success: true, version });
  } catch (e: any) {
    console.error("Puppeteer launch failed:", e);
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}
