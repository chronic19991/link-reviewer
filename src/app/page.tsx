"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{
    overall_sentiment?: string;
    strengths?: string[];
    weaknesses?: string[];
    summary?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setButtonDisabled(true);

    try {
      // Step 1: Fetch page content
      console.log("[ReviewSummarizer] Step 1: Calling /api/fetch-page");
      const fetchRes = await fetch("/api/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      // FIX: Check response status BEFORE parsing JSON
      if (!fetchRes.ok) {
        // Try to get error from response text (in case it's not valid JSON)
        const errorText = await fetchRes.text().catch(() => "");
        console.error("[ReviewSummarizer] Fetch failed:", fetchRes.status, errorText);
        throw new Error(
          errorText ? `خطای سرور (${fetchRes.status}): ${errorText}` : `خطای سرور: ${fetchRes.status} ${fetchRes.statusText}`
        );
      }

      // Now safe to parse JSON
      const fetchData = await fetchRes.json();
      console.log("[ReviewSummarizer] Fetch response keys:", Object.keys(fetchData));

      if (fetchData.error) {
        throw new Error(fetchData.error);
      }

      if (!fetchData.text || fetchData.text.length < 200) {
        throw new Error("متن استخراج‌شده خیلی کوتاه است. امکان دارد سایت نیاز به لاگین داشته باشد.");
      }

      // Step 2: Summarize
      console.log("[ReviewSummarizer] Step 2: Calling /api/summarize, text length:", fetchData.text.length);
      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fetchData.text }),
      });

      if (!summarizeRes.ok) {
        const errorText = await summarizeRes.text().catch(() => "");
        console.error("[ReviewSummarizer] Summarize failed:", summarizeRes.status, errorText);
        throw new Error(
          errorText ? `خطای خلاصه‌سازی: ${errorText}` : `خطای سرور: ${summarizeRes.status}`
        );
      }

      const summarizeData = await summarizeRes.json();
      console.log("[ReviewSummarizer] Summarize result:", summarizeData);

      if (summarizeData.error) {
        throw new Error(summarizeData.error);
      }

      setResult(summarizeData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ReviewSummarizer] Caught error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
      setButtonDisabled(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Review Summarizer
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          لینک صفحه محصول را وارد کنید تا نظرات کاربران خلاصه شود
        </p>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product-page"
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={buttonDisabled || !url.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "در حال پردازش..." : "خلاصه کن"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">حس کلی</h3>
              <p className="text-gray-700 dark:text-gray-300">{result.overall_sentiment}</p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">نقاط قوت</h3>
              <ul className="list-disc list-inside space-y-1 text-green-700 dark:text-green-300">
                {result.strengths?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">نقاط ضعف</h3>
              <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300">
                {result.weaknesses?.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">خلاصه</h3>
              <p className="text-blue-700 dark:text-blue-300">{result.summary}</p>
            </div>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-12">
            نتیجه اینجا نمایش داده میشود
          </div>
        )}
      </div>
    </div>
  );
}
