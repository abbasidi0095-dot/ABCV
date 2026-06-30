/**
 * Job-page fetcher: try HTTP fetch first, fall back to headless Playwright
 * for JS-rendered or bot-protected sites. Returns raw HTML / text.
 */

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface ScrapeResult {
  html: string;
  finalUrl: string;
  via: "fetch" | "playwright";
}

export async function scrapeJob(url: string, timeoutMs = 20000): Promise<ScrapeResult> {
  let res: ScrapeResult | null = null;
  try {
    res = await fetchHttp(url);
  } catch (err) {
    console.warn("scrape.fetch failed:", err instanceof Error ? err.message : err);
  }

  if (res && pageLooksComplete(res.html)) return res;
  return playwrightFallback(url, timeoutMs);
}

async function fetchHttp(url: string): Promise<ScrapeResult> {
  const r = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  return { html, finalUrl: r.url, via: "fetch" };
}

function pageLooksComplete(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Heuristic: page has >1500 chars of body text — smells like real content
  const strippedText = text.replace(/<[^>]+>/g, " ");
  return strippedText.trim().length > 1500;
}

async function playwrightFallback(url: string, timeoutMs: number): Promise<ScrapeResult> {
  const { chromium } = await import("playwright");
  // Use Playwright's downloaded chrome-headless-shell to share runtime
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    // Give lazy-loaded content a chance
    await page.waitForTimeout(1500);
    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl, via: "playwright" };
  } finally {
    await browser.close();
  }
}

/** Strip HTML to plain text for cheaper LLM token usage. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}