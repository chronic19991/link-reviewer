import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callLLM(text: string): Promise<{
  overall_sentiment: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  }

  const prompt = `این متن یک صفحه محصول از یک فروشگاه آنلاین است. نظرات کاربران را پیدا کن و خروجی را فقط به صورت JSON با این ساختار برگردان:
{
  "overall_sentiment": "مثبت / منفی / مخلوط",
  "strengths": ["نظر مثبت 1", "نظر مثبت 2"],
  "weaknesses": ["نظر منفی 1", "نظر منفی 2"],
  "summary": "خلاصه کلی نظرات"
}
اگر نظری پیدا نشد، در summary بنویس "نظری یافت نشد".

متن صفحه:
${text}`;

  console.log("[Summarize] Calling LLM with text length:", text.length);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  console.log("[Summarize] OpenRouter response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Summarize] API error:", response.status, errorText);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error("[Summarize] No content in response:", data);
    throw new Error("No content returned from OpenRouter");
  }

  console.log("[Summarize] LLM raw content:", content.slice(0, 200));

  let parsed: {
    overall_sentiment: string;
    strengths: string[];
    weaknesses: string[];
    summary: string;
  };

  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("[Summarize] Failed to parse JSON from model response");
        throw new Error("Failed to parse JSON from model response");
      }
    } else {
      console.error("[Summarize] No JSON found in model response");
      throw new Error("Failed to parse JSON from model response");
    }
  }

  return {
    overall_sentiment: parsed.overall_sentiment || "نامشخص",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    summary: parsed.summary || "خلاصهای موجود نیست",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== "string") {
      console.log("[Summarize] Missing or invalid text");
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length < 200) {
      console.log("[Summarize] Text too short:", text.length);
      return NextResponse.json(
        { error: "متن استخراج شده خیلی کوتاه است. سایت احتمالا نظرات را به جاوااسکریپت بارگذاری میکند." },
        { status: 400 }
      );
    }

    console.log("[Summarize] Starting summarization for text length:", text.length);
    const result = await callLLM(text);
    console.log("[Summarize] Success:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Summarize] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
