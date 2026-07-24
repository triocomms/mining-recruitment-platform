# FiFoDiDo

A recruitment platform for the global mining and resources industry. Candidates build rich, privacy-first profiles (tickets, site experience, FIFO preferences, commodities) and apply free; employers post jobs manually or via CSV, message candidates, and subscribe to monthly plans through Stripe.

Built with **Next.js 14 (App Router) + TypeScript + PostgreSQL (Prisma) + Stripe + S3-compatible object storage + Tailwind CSS**. Mobile-first throughout.

> **Note:** the source was authored in a sandbox without access to Prisma's engine downloads, so `npm install` / `next build` have **not** been run here. Expect the usual first-run wrinkles (typos in imports, etc.) to surface on your first local build — everything is structured to be fixed quickly.

## Quick start

```bash
npm install
cp .env.example .env        # then fill in values (see below)
npx prisma generate
npx prisma db push          # or `prisma migrate dev` for a migration history
npx prisma db seed          # demo accounts, jobs, and news posts
npm run dev
```

Seeded logins (password `fifodido-dev` for all):

| Email | Role |
|---|---|
| `admin@fifodido.local` | Admin |
| `employer@fifodido.local` | Employer (verified, "Red Range Resources") |
| `candidate@fifodido.local` | Candidate (public profile) |

## Environment

See `.env.example`. You need:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — e.g. `http://localhost:3000` and `openssl rand -base64 32`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the `STRIPE_PRICE_*` price IDs (create three recurring prices for Bronze/Silver/Gold and one one-time price for the overage credit in the Stripe dashboard)
- `S3_*` — any S3-compatible store works (AWS S3, Cloudflare R2, MinIO). The bucket must be **private**; the app serves files only via short-lived presigned URLs.

Local Stripe webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Architecture at a glance

```
src/
  app/                 Pages (App Router) + API routes under app/api
  components/          Client components (forms, uploads, composer, ...)
  lib/                 auth, prisma, plans/quota, rate limits, S3,
                       visibility rules, CSV import, privacy (export/erasure)
  middleware.ts        Role-guards /dashboard/* (UX layer only)
prisma/
  schema.prisma        Full data model
  seed.ts              Demo data
docs/                  CSV template, roadmap
```

### Key business rules (where to find them)

- **Privacy by default** — candidate profiles are `PRIVATE`; switching to `PUBLIC` writes an auditable `ConsentRecord` (`api/profile`). Public means *visible to authenticated, KYB-verified employers only* — enforced server-side in `lib/visibility.ts`, and all `/candidates/*` responses carry `X-Robots-Tag: noindex` (`next.config.mjs`).
- **GDPR/CCPA self-service** — `api/privacy/export` returns a full JSON bundle; `api/privacy/delete` anonymises the user, deletes S3 objects, and redacts their messages (`lib/privacy.ts`).
- **Quota & billing** — plan definitions in `lib/plans.ts`; atomic slot consumption with overage-credit fallback in `lib/quota.ts`; Stripe lifecycle handled in `api/stripe/webhook` (period resets on `invoice.paid`).
- **Anti-spam messaging** — caps in `lib/rate-limit.ts`; employers need verification + an active plan for outreach; candidates can only initiate with companies they've applied to.
- **CSV import** — `lib/csv-import.ts` (schema + per-line errors), `api/jobs/import` (dedupe on `external_ref`, drafts anything over quota). Template at `docs/job-import-template.csv` (also served at `/docs/job-import-template.csv`).

## Deployment notes

- Run the app behind HTTPS; NextAuth JWT sessions require `NEXTAUTH_SECRET` set in production.
- Point the Stripe webhook endpoint at `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET` from the dashboard.
- The soft-delete grace period assumes a scheduled job for the final hard purge of `User` rows where `deletedAt` is older than your retention window — add a cron (e.g. daily) that deletes those rows; all dependents cascade.
- Job expiry (`expiresAt`) is set on publish but nothing flips `PUBLISHED → EXPIRED` automatically yet; add a small cron or handle it lazily in queries.

## Roadmap

See `docs/ROADMAP.md` — Phase 2 covers RSS feed imports, the candidate "Promote Me" paid boost, and employer analytics; Phase 3 adds multi-language.
