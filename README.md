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
- **Postgres** on Neon, free tier.
- **Drizzle ORM** — chosen over Prisma. Reasons: no separate engine binary or
  `generate` step to keep in sync, a much smaller cold-start footprint on
  Vercel's free serverless tier, and plain-SQL semantics that suit a small
  hand-rolled schema better than Prisma's client generation. Schema lives in
  `lib/db/schema.ts`; `npm run db:push` applies it.
- **Recharts** for the projection chart.
- **Plaid** (free Trial plan) for the Chase connection.
- **Vercel** for deployment.

**Hard constraint: the entire stack must stay free.** No paid tiers anywhere —
not for the bank connection, the database, or hosting. If a feature can only be
built on a paid tier, the feature gets cut or reworked.

## A note on Plaid (and why it's Plaid, not Teller)

The original plan used Teller.io, but Teller currently has **no findable
public signup path** — the marketing site, docs, and login page all link to
nothing but "Sign in," and `/signup` 404s. Rather than block on that, the
project switched to Plaid, which turned out to be a better fit anyway.

Plaid's **Trial plan** (available to teams created from April 15, 2026
onward) gives free access to **real production data for up to 10
connections** — including Chase — with no manual approval step. That's more
than enough for a single-user app connecting one Chase login.

Plaid has an official Node SDK (`plaid` on npm, already installed) plus
official React bindings for the account-linking widget (`react-plaid-link`,
also installed). The flow: create a `link_token` server-side, open Plaid Link
client-side with `react-plaid-link` to get a `public_token`, exchange that
server-side for a permanent `access_token`, then use the `access_token` for
`/accounts/get` and `/transactions/sync` calls. Details and code sketch are in
`lib/plaid/client.ts`.

Two Plaid environments are relevant here: `sandbox` (fake data, safe for
building UI, no bank needed) and `production` (real Chase data, consumes one
of the 10 free trial connections). `PLAID_ENV` in `.env.local` controls which
one is active; each environment has its own secret.

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
  plaid/
    client.ts   Plaid API client (placeholder, flow notes inline)
    types.ts    Plaid-related types (placeholder)
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

Everything below is done — this repo is ready to open in Claude Code and
start building against real infrastructure.

- **Postgres (Neon)** — project `runway` created on the free tier (AWS US
  East 2). `DATABASE_URL` is filled in `.env.local`.
- **GitHub repo** — created at <https://github.com/Mamadouba2004/runway>,
  all files pushed.
- **Plaid** — account created, free Trial plan active (10 real connections,
  Chase included, no further approval needed). `PLAID_CLIENT_ID`,
  `PLAID_SANDBOX_SECRET`, and `PLAID_PRODUCTION_SECRET` are filled in
  `.env.local`, with `PLAID_ENV=sandbox` set as the safe default for initial
  development.

## Still needed from me (Adou)

Nothing blocking. When ready to link the real Chase account instead of
Sandbox test data, switch `PLAID_ENV` to `production` in `.env.local` — that
will start using one of the 10 free trial connections.
