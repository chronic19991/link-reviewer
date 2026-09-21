import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, noscript, iframe").remove();
  $(".ads, .advertisement, [class*='ad-'], [id*='ad-']").remove();

  // Try to find review/comment sections specifically
  const reviewSelectors = [
    ".c-review",
    "[class*='review']",
    "[class*='comment']",
    "[class*='view']",
    ".comment-list, .review-list, .user-comments",
    "[data-testid='review'], [data-testid='comment']",
  ];

  let reviewText = "";
  for (const selector of reviewSelectors) {
    try {
      const elements = $(selector);
      if (elements.length > 0) {
        reviewText += elements.text() + "\n---\n";
      }
    } catch {}
  }

  // Get main content area
  const mainContent =
    $("main").text() ||
    $("#mainContent").text() ||
    $(".main-content").text() ||
    $(".product-page").text() ||
    $(".product-view").text() ||
    "";

  // Get all visible text from body
  const bodyText = $("body").text() || "";

  // Combine with priority to reviews
  const text = [reviewText, mainContent, bodyText]
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);

  return text;
}

async function fetchWithPlaywright(url: string): Promise<string> {
  const timeoutMs = 25000;

  console.log("[Playwright] Launching browser for:", url);

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "fa-IR",
      javaScriptEnabled: true,
    });

    // Block tracking/beacon resources to speed up loading
    await context.route("**/*intrack*", (route) => route.abort());
    await context.route("**/analytics*", (route) => route.abort());
    await context.route("**/*pixel*", (route) => route.abort());
    await context.route("**/*beacon*", (route) => route.abort());
    await context.route("**/*tracker*", (route) => route.abort());

    const page = await context.newPage();

    page.on("request", (req) => {
      console.log("[Playwright] Request:", req.url().slice(0, 100));
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        console.log("[Playwright] Error:", res.status(), res.url().slice(0, 100));
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Wait a bit for dynamic content
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 500);
        await new Promise((r) => setTimeout(r, 200));
      }
    });

    await page.waitForTimeout(1000);

    const html = await page.content();
    console.log("[Playwright] HTML length:", html.length);

    await browser.close();
    return html;
  } catch (error) {
    console.error("[Playwright] Error:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body?.url;

    if (!url || typeof url !== "string") {
      console.log("[FetchPage] Invalid URL:", url);
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed" }, { status: 400 });
    }

    console.log("[FetchPage] Fetching URL:", url);

    // First try static fetch
    const controller = new AbortController();
    const staticTimeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(staticTimeout);

    console.log("[FetchPage] Response status:", response.status);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    console.log("[FetchPage] Raw HTML length:", html.length);

    let text = cleanHtml(html);
    console.log("[FetchPage] Cleaned text length (static):", text.length);

    // If content is too short, try with Playwright (block trackers)
    if (text.length < 500) {
      console.log("[FetchPage] Content too short, trying Playwright...");
      try {
        const dynamicHtml = await fetchWithPlaywright(url);
        console.log("[FetchPage] Playwright HTML length:", dynamicHtml.length);
        text = cleanHtml(dynamicHtml);
        console.log("[FetchPage] Playwright cleaned text length:", text.length);
      } catch (playwrightError) {
        console.error("[FetchPage] Playwright error:", (playwrightError as Error).message);
        if (text.length >= 100) {
          console.log("[FetchPage] Using static content as fallback");
        } else {
          return NextResponse.json(
            { error: "نمیتوان از سایت استخراج کرد. ممکن است نیاز به لاگین داشته باشد یا از ربات محافظت شده باشد." },
            { status: 400 }
          );
        }
      }
    }

    if (text.length < 200) {
      console.log("[FetchPage] Text still too short after all attempts");
      return NextResponse.json(
        { error: "متن استخراج شده خیلی کوتاه است. سایت احتمالا نظرات را به جاوااسکریپت بارگذاری میکند." },
        { status: 400 }
      );
    }

    console.log("[FetchPage] Success! Returning text of length:", text.length);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[FetchPage] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
