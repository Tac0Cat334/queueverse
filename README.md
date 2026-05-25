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

### Historical data sync (required for daily charts)

Daily charts load **all points collected today** from Supabase. Data must sync every 5 minutes **without anyone on the site**.

Set up **at least two** of the options below. GitHub scheduled workflows can slip by hours on inactive repos; Vercel Hobby cron is limited to once per day.

**Option A — GitHub Actions (included in repo)**

1. GitHub → your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add secret: `CRON_SECRET` (same value as in Vercel)
3. Two workflows run on offset schedules: `sync-wait-times.yml` and `sync-wait-times-backup.yml`

**Option B — cron-job.org (strongly recommended backup)**

1. Sign up at [cron-job.org](https://console.cron-job.org)
2. Create a job:
   - URL: `https://queueverse.vercel.app/api/cron/sync-wait-times`
   - Schedule: every 5 minutes
   - Request method: GET
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`
3. Enable email alerts on failure

**Option C — Vercel Cron (`vercel.json`)**

Included for Pro plans. On Hobby, use Options A + B instead.

**Verify sync is healthy**

- Open the site — the home page shows **Chart snapshots collected X ago**
- Or call `GET /api/sync-health` (public JSON with last snapshot time and status)

After sync runs during park hours, opening any ride shows the full chart from opening through now — gray bands mean we collected data while Queue-Times reported the ride closed.

## Data

Wait time data provided by [Queue-Times.com](https://queue-times.com). Epic Universe Park ID: **334**.

## License

MIT
