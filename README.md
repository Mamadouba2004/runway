# Runway

A single-user, read-only personal finance dashboard. It connects to one Chase
checking account plus its linked savings account, pulls balances and
transactions, and answers one question above all others: **how long does my
money last?**

Read-only by design — Runway never initiates transfers or payments. It reads
account data and renders it.

This repo is currently **scaffolding only**. No application logic or UI has
been written yet; that's the next phase, in Claude Code.

## Core features

| Feature | What it does |
| --- | --- |
| **Runway projection chart** | Projects the daily balance forward from today and shows the date it would hit zero, given current income and spending. The centerpiece of the dashboard. |
| **Income-mode toggle** | Switch between **Internship** (paycheck income, higher spend) and **School** (little or no income) modes. The projection recalculates against whichever mode is active. |
| **Per-category spending caps** | A monthly cap per category, with progress against it for the current month. |
| **Subscriptions tracker** | Recurring charges detected from transaction history, with amount and next expected date, so nothing renews unnoticed. |
| **People** | Zelle transfers grouped by counterparty. Deliberately **excluded from spending totals and caps** — sending a friend $40 for dinner isn't the same as spending $40, and lumping them together wrecks both the category caps and the runway math. |
| **Savings milestones** | Named savings targets with an amount and target date, and progress toward each. |

## Stack

- **Next.js** (App Router, TypeScript, Tailwind v4) — **dark mode only**, no
  light theme and no toggle. The palette lives in `app/globals.css`; `<html>`
  carries a permanent `dark` class.
- **Postgres** on Neon or Supabase, free tier.
- **Drizzle ORM** — chosen over Prisma. Reasons: no separate engine binary or
  `generate` step to keep in sync, a much smaller cold-start footprint on
  Vercel's free serverless tier, and plain-SQL semantics that suit a small
  hand-rolled schema better than Prisma's client generation. Schema lives in
  `lib/db/schema.ts`; `npm run db:push` applies it.
- **Recharts** for the projection chart.
- **Teller.io** (free tier) for the Chase connection.
- **Vercel** for deployment.

**Hard constraint: the entire stack must stay free.** No paid tiers anywhere —
not for the bank connection, the database, or hosting. If a feature can only be
built on a paid tier, the feature gets cut or reworked.

## A note on Teller

Teller publishes **no official Node server SDK**. The server side is a plain
REST API at `https://api.teller.io`, authenticated with **mutual TLS**: you
present the client certificate and private key from the Teller dashboard, and
pass the enrollment access token as HTTP Basic auth (token as username, empty
password). In Node that means building an `https.Agent` with `cert` and `key`
from the env vars — see the notes in `lib/teller/client.ts`.

The browser-side account-linking flow does have an official package,
`teller-connect-react`, which is installed. It uses `TELLER_APPLICATION_ID` and
returns the enrollment access token once, at link time — store it.

## Project structure

```
app/            Next.js App Router pages and layouts
components/     Shared UI components (placeholder)
lib/
  runway.ts     Balance-projection math (placeholder)
  categories.ts Categories and caps (placeholder)
  db/
    schema.ts   Drizzle schema (placeholder, planned tables listed inline)
    index.ts    Drizzle client (placeholder)
  teller/
    client.ts   Teller REST client (placeholder, mTLS notes inline)
    types.ts    Teller response types (placeholder)
.env.example    Required environment variables, no values
```

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

`.env.local` is gitignored. `.env.example` is not — keep it in sync when new
variables are added, and never put real values in it.

---

## Setup status

- **Postgres (Neon)** — done. Project `runway` created on the free tier (AWS
  US East 2). `DATABASE_URL` is filled in `.env.local`.
- **GitHub repo** — created at <https://github.com/Mamadouba2004/runway>,
  remote added locally. **Not yet pushed** — run `git push -u origin main`
  from this folder once (uses your machine's own GitHub credentials).
- **Teller developer account** — **not done, needs you.** Teller has no OAuth
  signup, only email + password, so this wasn't something to do on your
  behalf. Go to <https://teller.io>, sign in/sign up, create an application,
  and generate the certificate / private key pair. Then fill
  `TELLER_APPLICATION_ID`, `TELLER_CERTIFICATE`, and `TELLER_PRIVATE_KEY` in
  `.env.local`. Confirm the free tier covers the accounts needed (checking +
  savings) before building against it.

## Still needed from me (Adou)

1. `git push -u origin main` — one command, from this folder.
2. Teller account, application, and cert/key pair (see above) — the only
   remaining blocker for real data. Until it's done, development can proceed
   against mock data with the database and repo already wired up.
