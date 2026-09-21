# Review Summarizer

ابزاری ساده و لوکال برای خلاصه‌سازی نظرات کاربران محصولات آنلاین. لینک هر صفحه محصول را وارد کنید؛ برنامه نظرات را استخراج کرده و با هوش مصنوعی خلاصه‌ای از نقاط قوت، نقاط ضعف و حس کلی خریداران تولید می‌کند.

**Stack:** Next.js 15 · TypeScript · Tailwind v4 · Playwright · OpenRouter

---

## ✨ قابلیت‌ها

- **استخراج هوشمند متن** — ابتدا درخواست static می‌فرستد؛ اگر محتوای کمی برگشت (مثلاً سایت SPA باشد)، به‌طور خودکار Playwright اجرا می‌شود تا صفحات جاوااسکریپتی رندر شوند.
- **فیلتر تبلیغات و عناصر مزاحم** — با Cheerio تگ‌های `script`، `style`، `nav`، `footer` و المان‌های تبلیغاتی حذف می‌شوند.
- **تمرکز بر نظرات** — سلکتورهای مخصوص `.c-review`، `[class*='review']`، `[data-testid='review']` و غیره اولویت دارند.
- **مدل رایگان قابل انتخاب** — بیش از ۱۰ مدل رایگان OpenRouter پشتیبانی می‌شود (بدون هزینه).
- **UI فارسی و تمیز** — رابط کاربری راست‌چین با حالت تاریک/روشن خودکار.

---

## 🛠 پیشنیازها

| مورد | نسخه / توضیح |
|------|------------|
| [Node.js](https://nodejs.org) | **۱۸+** |
| npm یا yarn | — |
| [Playwright](https://playwright.dev) | خودش با `npm install` نصب می‌شود |
| کلید API رایگان OpenRouter | از https://openrouter.ai/settings/keys گرفته شود |

---

## 📦 نصب

```bash
cd D:/LinkReviewer/review-summarizer
npm install
```

---

## 🔧 تنظیمات محیط

در ریشه پروژه یک فایل `.env.local` بسازید (از نمونه زیر الگو بگیرید):

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=qwen/qwen3.8-27b:free
```

### مدلهای رایگان پیشنهادی OpenRouter

| مدل | توضیح |
|-----|------|
| `qwen/qwen3.8-27b:free` | عملکرد بالا — پیشنهاد اول |
| `z-ai/glm-5.2:free` | سریع و سبک |
| `inclusionai/ling-3.0-flash-vl:free` | چابک |
| `nvidia/nemotron-3.5-lightning:free` | نئرونترایز شده |
| `meta-llama/llama-3.1-8b-instruct:free` | پیش‌فرض |

> ⚠️ اگر خطای `401 User not found` دریافت کردید، کلید API منقضی یا اشتباه است. کلید جدیدی از پنل OpenRouter بسازید.

---

## 🚀 اجرای پروژه

```bash
npm run dev
```

سپس در مرورگر: **[http://localhost:3000](http://localhost:3000)**

برای ساخت نسخه نهایی:

```bash
npm run build
npm start
```

---

## 🏗 معماری پروژه

```
src/app/
├── page.tsx          ← رابط کاربری اصلی
├── layout.tsx        ← لایه ریشه (Geist font + Tailwind)
├── globals.css       ← استایل‌های پایه
└── api/
    ├── fetch-page/
    │   └── route.ts  ← دریافت HTML + استخراج متن (fetch + Playwright fallback)
    └── summarize/
        └── route.ts  ← ارسال به OpenRouter + بازگرداندن JSON خلاصه
```

**جریان داده:**
1. کاربر → URL را وارد و دکمه «خلاصه کن» را می‌زند
2. `POST /api/fetch-page` → HTML صفحه را دانلود می‌کند
3. Cheerio متن تمیز را استخراج می‌کند
4. `POST /api/summarize` → متن را به LLM می‌فرستد
5. پاسخ JSON شامل sentiment، strengths، weaknesses و summary نمایش داده می‌شود

---

## 🧪 تست با داده نمونه

فایل `test-summarize.json` حاوی متن فارسی نمونه است. برای تست بدون سایت واقعی:

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d @test-summarize.json
```

---

## 📄 مجوز

این پروژه تحت پروانه MIT منتشر شده است.
