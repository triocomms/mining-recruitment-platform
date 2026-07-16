# Overnight build — status & go-live steps

Branch: `phase-overnight` (main is untouched and still serving the live site).

## Done (all typecheck-clean)

### Phase 1 — Trust & safety
- **1.1 Job approval queue** — new `PENDING_REVIEW` status. Verified companies with ≥1 prior
  published ad and no upheld report auto-publish; everyone else queues for admin review.
  Spam heuristics (`src/lib/moderation.ts`): pay-to-apply phrases, off-platform contact info,
  near-duplicate ads within 24h — flagged ads always queue. Quota is consumed at submission.
  Admin approve/reject (reason required) in the dashboard; rejection reason surfaced to the
  employer on their jobs page and by email.
- **1.2 Suspend/unsuspend** — `User.suspendedAt/suspendedReason`, login blocked in
  `authorize()`, suspended-users panel + suspend-by-email form in admin, login page shows a
  clear message, email sent on suspension. (Note: existing JWT sessions last until expiry —
  ~30 days max; add a session-callback DB check later if instant lockout is needed.)
- **1.3 Report actions** — resolve (upheld) / dismiss with note via `/api/admin/reports`.
  Upheld reports feed the trust check in 1.1. Upheld report against a REVIEW auto-hides it.
- **1.4 Refunds** — `/api/admin/refunds` refunds an OveragePurchase (restores the job slot if
  the credit was spent; refunded credits can't be spent) or a subscription's latest invoice.
  Buttons in the new "Billing & refunds" admin section.
- **1.5 Audit log** — `AdminAuditLog` model; every admin action above plus KYB verify and blog
  curation writes an entry. Paginated viewer at `/dashboard/admin/audit`.

### Phase 2 — Revenue & ops visibility
- **2.1 Analytics** — `DailyStat` daily rollups (signups by role, jobs, applications, MRR by
  tier, churn, overage revenue) + `/dashboard/admin/analytics` with 30-day sparkline charts.
  Backfills on page load; refreshed nightly by cron.
- **2.2 Broadcast email** — composer at `/dashboard/admin/emails` with segments (candidates/
  employers/all, plan tier, commodity, region), audience preview, and confirm-before-send.
  Excludes anyone whose latest MARKETING_EMAIL consent is withdrawn.
- **2.3 Email log** — every send (transactional + broadcast) recorded in `EmailLog` with
  status + error; resend button in admin. Provider: Resend via REST (no SDK). Set
  `RESEND_API_KEY` + `EMAIL_FROM` in Vercel — until then sends log as FAILED/not-configured.
- **2.4 Cron** — `/api/cron/daily` (vercel.json schedules 18:00 UTC daily): job-ad expiry,
  GDPR hard-purge (30-day grace), analytics rollup. Each run recorded in `CronRun`; status
  panel on the admin dashboard. Protect with `CRON_SECRET` env var (optional but recommended).
  Transactional emails now fire on KYB decisions, job approve/reject, and suspension.

### Phase 3 — Content & growth
- **3.1 Blog media** — cover image (+ required alt text) and up-to-12 image gallery (alt
  required per image) on posts; new `blogCover`/`blogImage` upload kinds; images downscaled
  client-side (max 1920px JPEG) before upload; public read for blog imagery through
  `/api/files`. Body is now markdown rendered by a safe escape-first renderer
  (`src/lib/markdown.ts`) supporting headings/bold/links/lists/images + YouTube/Vimeo embeds.
  New composer at `/dashboard/posts/new` (admins → editorial, employers → company posts).
- **3.2 JSON-LD** — `schema.org/JobPosting` structured data on job pages (Google Jobs).
- **3.3 Programmatic SEO** — `/jobs/browse` index + `/jobs/browse/{facet}/{region}` landing
  pages (commodity/site-type/FIFO × region), only generated for combos with live jobs,
  with canonical URLs and metadata.
- **3.4 Employer reviews** — candidates who applied can leave one rating+review per company;
  aggregate ★ on company pages; moderated via the existing report pipeline.

### Phase 4 (partial)
- **4.1 Matching engine** — `src/lib/matching.ts`: transparent weighted scoring (commodity 30,
  site experience 30, tickets/certs 20, FIFO/roster fit 20, small location bonus) with
  human-readable reasons. Resume search can now rank candidates against any of your job ads
  (`jobId` param + dropdown in the employer UI), showing "n% match" and why.

Not started: 4.2 saved searches/alerts, 4.3 ATS pipeline, 4.4 resume parsing, Phase 5.

## Go-live steps (in order!)
1. Run `docs/migrations/phase1.sql` in the database query editor (Vercel → Storage → your
   Supabase DB → Query, read-only OFF). Note: run the ALTER TYPE line by itself first.
2. Run `docs/migrations/phase2.sql` (one block).
3. Run `docs/migrations/phase3.sql` (step 1, then step 2).
4. Merge `phase-overnight` into `main` → Vercel deploys.
5. Optional env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.

Deploying before the migrations will break job posting and the admin dashboard — do the SQL first.
