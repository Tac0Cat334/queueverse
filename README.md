# QueueVerse

**Live Wait Times & Park Analytics**

QueueVerse is an independent theme park analytics platform. Currently tracking **Epic Universe** wait times with live data and historical crowd trends.

Built with Next.js 15, Supabase, Recharts, and the [Queue-Times API](https://queue-times.com).

> QueueVerse is not affiliated with Universal Destinations & Experiences, NBCUniversal, or any theme park operator.

## Features

- Live wait times for all Epic Universe rides
- Historical analytics and trend charts
- Best time to ride insights
- Light/dark mode
- Mobile-first, minimal design

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

See `.env.example` for all required keys (Supabase, Queue-Times, cron secret).

## Deploy to Vercel

1. Push this repo to GitHub (see `.env.example` — never commit `.env.local`).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add all environment variables from `.env.example` in **Project → Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL after the first deploy (e.g. `https://queueverse.vercel.app`).
5. Deploy.
6. In Resend, set the webhook URL to `https://YOUR-VERCEL-URL/api/webhooks/resend` with event `email.received`.

### Historical data sync (free, every 5 minutes)

Vercel **Hobby** only allows daily crons, so use a free external scheduler instead:

1. Sign up at [cron-job.org](https://console.cron-job.org) (free).
2. **Create cron job**:
   - **URL:** `https://YOUR-VERCEL-URL/api/cron/sync-wait-times`
   - **Schedule:** every 5 minutes (`*/5 * * * *`)
   - **Request method:** GET
3. Under **Advanced** → **Headers**, add:
   - **Name:** `Authorization`
   - **Value:** `Bearer YOUR_CRON_SECRET` (same value as `CRON_SECRET` in Vercel)
4. Save and enable the job.

This keeps Supabase filled with wait-time history without a Vercel Pro plan.

## Data

Wait time data provided by [Queue-Times.com](https://queue-times.com). Epic Universe Park ID: **334**.

## License

MIT
