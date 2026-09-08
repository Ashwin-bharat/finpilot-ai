# FinPilot AI

A full-stack, AI-powered investment intelligence platform for the Indian equity and crypto markets — built end-to-end with real market data, deterministic financial engines, and a Gemini-powered assistant that's grounded in verified data rather than free-form generation.

> ⚠️ Educational / portfolio project. Not certified financial advice. All AI-generated analysis is explicitly probabilistic, sourced, and never predicts future prices as fact.

---

## What it does

- **Live market data** for 7,200+ NSE and BSE listed securities
- **Real technical analysis** — RSI, MACD, Bollinger Bands, ATR, VWAP, pivot points, computed server-side from real OHLCV history, never estimated by an LLM
- **Institutional-style market structure analysis** — swing points, break of structure, order blocks, fair value gaps, liquidity sweeps, dealing ranges
- **Fundamental valuation engine** — two-stage DCF model, Benjamin Graham Number, 9-point Piotroski F-Score, sector benchmarking with honest sample-size gating
- **Risk analytics** — historical volatility, beta vs. NIFTY 50, maximum drawdown, historical-simulation VaR
- **Portfolio intelligence** — Herfindahl diversification scoring, concentration alerts, pairwise correlation, top/worst contributor attribution
- **Cross-engine synthesis** — a deterministic scoring model that combines technical, fundamental, risk, and news signals into a single confluence score, and explicitly flags when signals conflict (e.g. cheap stock, weak momentum)
- **AI financial assistant** (Google Gemini) — every response is grounded via tool-calling against the real engines above, schema-validated, and scanned for overconfident language before it ever reaches a user; falls back to a fully deterministic pipeline if the LLM is unavailable, with identical grounding guarantees
- **Simulated paper trading + real broker integration** (Angel One SmartAPI) with a strict, non-bypassable safety gate before any live-money order can be placed
- **UPI wallet funding** (Razorpay) for paper trading balances
- **Cryptocurrency module** — CoinDCX-backed data and trading, kept architecturally separate from equities (no shared fundamentals model, since DCF/Piotroski don't apply to crypto)

## Screenshots

*(add 3-4 screenshots here — dashboard, AI assistant response, stock detail page, and the green CI checkmark)*

## Tech stack

**Frontend** — Next.js 15, React, TypeScript, Tailwind CSS, `lightweight-charts`
**Backend** — NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis
**AI** — Google Gemini (function/tool calling), custom deterministic fallback pipeline
**Infra** — Docker, GitHub Actions CI/CD, Jest (unit + integration testing)

## Why this project is different from a typical "AI wrapper" app

Most consumer apps that bolt on "AI insights" just pipe a prompt straight to an LLM and hope it doesn't hallucinate. FinPilot inverts that:

```
Real market data  →  Deterministic calculation engines  →  Structured, verified output  →  LLM interprets and explains it
```

The LLM **never** calculates a price, an indicator, or a valuation — it only explains numbers that were already computed by real TypeScript engines running on real data. A response-validation layer rejects and regenerates any output that's missing required fields (risk level, confidence score, sources) or that slips into overconfident language ("guaranteed," "will definitely rise").

## Built and verified with real discipline, not just "it compiles"

Every major engine in this project was checked by hand before being trusted — not just tested, *verified*:

- Deliberately broke a test's expected value to prove the test suite actually catches wrong answers, not just green-lights everything
- Cross-checked every number in a live AI response against the backend's own raw API output, line by line
- Found and fixed a case where identical fundamentals produced two different DCF valuations across NSE/BSE listings of the same company (a real methodology bug, not a rounding issue)
- Found and fixed a mislabeled 200-day VWAP that was silently masquerading as a 20-day trading-session VWAP
- Confirmed via `git log` and live API calls whether the AI assistant was actually using Gemini or silently falling back to a deterministic pipeline, rather than assuming

This verification discipline — catch it, prove it, fix it, re-verify — is arguably the most transferable engineering skill demonstrated in this project.

## Local setup

```bash
git clone <repo-url>
cd finpilot-ai

# Backend
cd apps/backend
cp .env.example .env   # fill in your own DATABASE_URL, JWT secrets, GEMINI_API_KEY, etc.
docker compose up -d   # starts Postgres + Redis
npm install
npx prisma migrate dev
npm run seed
npm run dev

# Frontend (separate terminal)
cd apps/frontend
cp .env.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Testing & CI

```bash
npm run test          # backend unit + integration tests (Jest)
npm run test --prefix apps/frontend   # frontend tests (Vitest)
npm run type-check
npm run lint
```

GitHub Actions runs the full pipeline (type-check, lint, test, build) on every push to `main`.

## Known limitations

- Fundamental data is manually seeded for a small set of major stocks — most of the ~7,200 imported symbols have real price/technical data but no fundamentals yet
- News sentiment defaults to a clearly-labeled mock feed unless a Marketaux API key is configured
- Real broker and crypto exchange integrations require the user's own account credentials — this app is an aggregator/analysis layer, not a licensed broker or depository participant
- Not currently deployed to a public URL — see the demo video / screenshots above for a full walkthrough

## Disclaimer

This project does not constitute financial advice. It is an educational demonstration of full-stack engineering, LLM grounding techniques, and financial data modeling. Nothing in this repository should be used as the basis for real investment decisions.

