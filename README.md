# Review Summarizer - راهنمای نصب و راه‌اندازی

## پیش‌نیازها
- Node.js 18+
- npm یا yarn
- Playwright (نصب شده)

## نصب

```bash
cd D:/LinkReviewer/review-summarizer
npm install
```

## تنظیمات محیط (مهم)

فایل `.env.local` باید حاوی کلید واقعی OpenRouter باشد. کلید فعلی نامعتبر است.

### دریافت کلید رایگان:
1. به https://openrouter.ai/ بروید
2. حساب کاربری بسازید (رایگان)
3. از بخش Settings → API Keys یک کلید بسازید
4. کلید را در `.env.local` جایگزین کنید

### فرمت صحیح `.env.local`:
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
OPENROUTER_MODEL=qwen/qwen3.8-27b:free
```

## اجرای پروژه

```bash
npm run dev
```

سپس در مرورگر: http://localhost:3000

## مشکل فعلی
کلید API موجود (`sk-or-...lder`) معتبر نیست و سرور خطای `401 User not found` برمی‌گرداند.

## لاگ‌ها
مسیر لاگ‌ها: `D:/LinkReviewer/review-summarizer/.next/dev/logs/next-development.log`

## مدل‌های رایگان موجود
- qwen/qwen3.8-27b:free
- z-ai/glm-5.2:free
- inclusionai/ling-3.0-flash-vl:free
- nvidia/nemotron-3.5-lightning:free
