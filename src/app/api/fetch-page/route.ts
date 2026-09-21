import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, noscript, iframe, .ads, .advertisement, [class*='ad-'], [id*='ad-']").remove();
  
  // Keep only main content selectors for digikala
  const contentSelectors = [
    ".c-product-pannel__reviews",
    ".c-comment",
    ".c-review", 
    "[class*='review']",
    "[class*='comment']",
    ".product-features",
    ".description",
    ".c-description"
  ];
  
  // If we have specific review containers, extract from those
  let reviewText = "";
  for (const selector of contentSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      reviewText += elements.text() + "\n";
    }
  }
  
  // Also get all visible text
  const allText = $("body").text() || $.text();

  // Combine review-specific text with full text
  const text = reviewText + "\n" + allText;

  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);
}

async function fetchWithPlaywright(url: string): Promise<string> {
  const timeoutMs = 60000;
  
  console.log("[Playwright] Launching browser for:", url);

  try {
    const browser = await chromium.launch({
      headless: true,
      channel: "chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "fa-IR",
      javaScriptEnabled: true,
    });

    const page = await context.newPage();
    
    // Enable request/response logging for debugging
    page.on("request", (req) => {
      console.log("[Playwright] Request:", req.url().slice(0, 100));
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        console.log("[Playwright] Response error:", res.status(), res.url().slice(0, 100));
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    
    // Wait for dynamic content to load
    await page.waitForTimeout(5000);
    
    // Scroll down to trigger lazy-loaded content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(undefined);
          }
        }, 100);
      });
    });
    
    await page.waitForTimeout(2000);
    
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
      console.log("[FetchPage] Invalid URL format:", url);
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed" }, { status: 400 });
    }

    console.log("[FetchPage] Fetching URL:", url);

    // First try static fetch
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });

    console.log("[FetchPage] Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.log("[FetchPage] Failed response body:", errorBody.slice(0, 500));
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    console.log("[FetchPage] Raw HTML length:", html.length);
    
    let text = cleanHtml(html);
    console.log("[FetchPage] Cleaned text length (static):", text.length);
    
    // If content is too short, try with Playwright
    if (text.length < 500) {
      console.log("[FetchPage] Content too short, trying Playwright...");
      try {
        const dynamicHtml = await fetchWithPlaywright(url);
        console.log("[FetchPage] Playwright HTML length:", dynamicHtml.length);
        text = cleanHtml(dynamicHtml);
        console.log("[FetchPage] Playwright cleaned text length:", text.length);
      } catch (playwrightError) {
        console.error("[FetchPage] Playwright error:", playwrightError);
        // Return static content anyway if it exists
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
        { error: "متن استخراج شده خیلی کوتاه است. ممکن است سایت نظرات نداشته باشد یا از جاوااسکریپت پیچیده استفاده کند." },
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
