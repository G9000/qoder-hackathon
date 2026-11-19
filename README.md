# Bengkel Baik

Photo of visible car damage in, **normalised, comparable workshop quotes** out.

Built for Alibaba Cloud x Developer Kaki QodeFest, 19 Nov 2026 — Digital Inclusion / Public Good.

> **RM800 vs RM780 is not a choice.** Those two quotes price different things: part grade,
> labour, warranty and lead time. We normalise them, so a comparison becomes possible.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # ranking unit tests
npx tsc --noEmit
npm run build
```

Optional photo analysis:

```bash
cp .env.local.example .env.local
# put DASHSCOPE_API_KEY in .env.local — never commit it
```

Without a key the app still works: the six damage chips are the manual path, and the API
returns a graceful empty result instead of throwing.

## Demo path

1. Perodua + Myvi, tap **Front bumper** → ranked table appears.
2. Ah Seng Auto (RM800, OEM, 12-month warranty) ranks **above** JB Motorworks
   (RM780 sticker, aftermarket, no warranty) because effective cost includes warranty risk.
3. The Honda/Toyota-only shop is absent — it doesn't serve a Perodua.
4. Premium Auto KL is flagged as an outlier, not silently ranked first.
5. Tick the red safety box (or let the model set it) → **Don't drive — tow it**, no prices.

Try `/?offline=1` for the conference-wifi-proof path: local JSON only, cached assessment.

## Data honesty

**Prices are a seeded survey of 6 workshops, 19 Nov 2026.** Every price band carries an
`estimated · 19 Nov` chip and a provenance row. They are estimates to compare, not market
prices. An inspection confirms the repair.

Classification accuracy on real photos has **not been measured yet** — that number belongs
in this README only after we run the six labelled samples with a live API key. Do not invent it.

## What is deliberately not built

Video input, booking, payments, live workshop APIs, maps, accounts, chat history, admin UI,
price scraping. The camera cannot see brakes, air-con or engine faults, so those are not
damage classes in this build.

Car identity (make/model) is **user-selected**. Qwen classifies damage only — that is the
reliable half.

## Where things live

- `app/page.tsx` — intake, damage chips, ranked table, safety stop
- `app/api/assess/route.ts` — one Qwen-VL call, zod validation, one retry, graceful empty
- `prompts/assess.ts` — six-class taxonomy and the "never say safe / never price" rules
- `lib/match.ts` — coverage × capability filter (filtered shops are hidden)
- `lib/normalize.ts` — mid price, warranty risk premium, effective cost, outlier, verdict
- `data/` — seeded workshops, quotes, offline cache
- `docs/ARCHITECTURE.md` — pipeline and trade-offs

## Evidence trail

Commit history is one commit per ticket (`T0`, `A1`–`A4`, `B1`, `C1`–`C2`, `D1`), built with
Qoder from the frozen contract in `AGENT.md`.
