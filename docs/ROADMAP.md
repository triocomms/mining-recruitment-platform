# FiFoDiDo — Roadmap

## Phase 1 — MVP (this codebase)

Shipped:

- Candidate registration with consent capture, private-by-default profiles, mining-specific fields (tickets/certs, site experience, FIFO/roster preferences, commodities), resume/cover-letter/photo uploads via presigned S3 URLs.
- Opt-in "visible to verified employers" switch with an append-only consent audit log; candidate pages carry `X-Robots-Tag: noindex` and are never shown to anonymous visitors.
- Job search with country/commodity/site/FIFO filters, priority placement for Gold subscribers, apply with cover note + resume snapshot.
- Employer registration, KYB document upload → admin verification queue, company pages with blog.
- Manual job posting + CSV bulk import (dedupe on `external_ref`, over-quota rows saved as drafts).
- Stripe subscriptions (Bronze/Silver/Gold) with monthly quota reset via webhook, pay-per-post overage credits.
- In-app messaging with anti-spam rules: candidates can only initiate with companies they've applied to; employer outreach requires verification + active plan, with per-tier daily caps and a global hard cap.
- Gold-tier resume database search over opted-in profiles (summary fields only).
- Candidate/employer/admin dashboards; self-service GDPR export (JSON) and account erasure.
- Editorial + company news hub with admin homepage curation.

## Phase 2

- **RSS/XML job feed import.** Extend `Job.source = RSS` (already in schema). Scheduled worker polls employer-configured feed URLs, maps to the same normalized schema as CSV import, dedupes on `externalRef`, respects quota with draft fallback. Add per-feed field-mapping config UI.
- **Promote Me for candidates.** Paid profile boosts — $29 / 30 days, $79 / 90 days — using `PromotionListing` (already in schema) and the `STRIPE_PRICE_PROMOTE_30` / `STRIPE_PRICE_PROMOTE_90` price IDs (already in `.env.example`). Promoted candidates appear in a dedicated feed on the employer dashboard and rank first in resume search. One-off Stripe Checkout, webhook activates the listing, cron expires it.
- **Employer analytics.** Per-job views, apply-through rate, source breakdown; plan-level funnel dashboard. Add a lightweight `JobView` event table with daily rollups.
- **Application pipeline improvements.** Kanban view of applicants, bulk status changes, rejection templates, interview scheduling links.
- **Notifications.** Email (and later push) for new applications, messages, and application status changes, with per-type opt-outs tied to `ConsentRecord`.
- **Saved searches & job alerts** for candidates (daily/weekly email digests).
- **Stripe customer portal** link for self-service plan changes, invoices, and cancellation.

## Phase 3

- **Multi-language UI** via `next-intl`; start with EN/ES/FR/PT (major mining jurisdictions), with locale-aware salary and date formatting (currency formatting is already `Intl`-based).
- **Localized job discovery**: region landing pages (Pilbara, Atacama, Ontario Ring of Fire...) for SEO.
- **Two-sided reviews** (site/camp reviews by verified employees) with moderation workflow.
- **API for ATS integrations** (Workday, SAP SuccessFactors, Greenhouse) — inbound postings and outbound applications.
- **Mobile apps** wrapping the mobile-first web UI, plus push notifications.

## Operational backlog (any phase)

- Scheduled hard-purge job for soft-deleted users after the legal grace period (erasure logic already anonymizes immediately).
- Job expiry cron (`expiresAt` → `EXPIRED`) and renewal prompts.
- Rate limiting at the edge (per-IP) in addition to per-user message caps.
- Object-storage lifecycle rules for orphaned uploads (presigned PUTs that never got attached).
- Automated tests: unit tests around `quota.ts`, `visibility.ts`, `rate-limit.ts`, and the CSV parser first — they encode the business rules.
