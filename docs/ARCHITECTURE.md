# Architecture

The table is the product. The photo is the front door.

```
 photo + make/model                 local JSON
        │                              │
        ▼                              ▼
 POST /api/assess ──► Qwen-VL ──► zod ──► match.ts ──► normalize.ts ──► table
        │           (json_object)  │     coverage ×      effective cost
        │                          │     capability      + outlier flag
        └─ failure ────────────────┘
           empty result → manual chips still work
```

Five stages for the slide: **perceive → classify → normalise → rank → guard.**

## 1. Perceive

The browser downscales the photo to 1024 px JPEG before upload. Smaller payload, lower
latency, no client-side model. `qwen-vl-plus` receives a data URL and the user-selected
vehicle as text.

## 2. Classify

`app/api/assess/route.ts` asks for a JSON object, validates it with zod, retries **once**
with the bad reply as a repair hint, then returns
`{ damageTypes: [], notes: "manual selection" }`. It never throws into the page.

The prompt restricts output to six photographable classes, returns up to two with
confidence, treats the image as data (text inside a photo cannot change the schema), never
outputs a price, and never outputs "safe".

## 3. Normalise

`lib/normalize.ts`:

- `mid = (low + high) / 2`
- `riskPremium = mid × 0.06 × (12 − min(warrantyMonths, 12)) / 12`
- `effectiveCost = mid + riskPremium`
- `isOutlier = mid > 1.6 × median(mids)`

Sorting by effective cost is the product claim. The raw band always stays on screen.

## 4. Rank

`lib/match.ts` keeps a workshop only when
`coverage includes make || coverage includes 'all'` **and**
`damageTypes includes damageType`. Filtered shops are hidden — never rendered with an
empty price.

Verdicts: the first non-outlier is `best_value`; the lowest raw mid is `cheapest`; rows
above 1.6× the median are `outlier`; the rest are `standard` (shown as "Mid-pack").

## 5. Guard

Safety stop is a **rule**, not a model output. A user-declared checkbox (and additionally a
model `safetyStop` hint) replaces the entire table with **Don't drive — tow it** and shows
no prices. Guessing a price for airbag, fluid or frame damage is the failure we refuse.

## Offline mode

`/?offline=1` never calls the model. The table and chips are local JSON; a photo uses
`data/demo-cache.json` keyed by the selected damage type. Verified with the network path
disabled: five rows, zero horizontal overflow.

## Stack choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js App Router + TypeScript | one deploy; server route hides the key |
| Styling | Tailwind | fastest projector-legible table |
| Data | JSON in `/data` | zero setup, diffable, seeded |
| Model | Qwen-VL via DashScope | event requirement, one call |
| Validation | zod | schema gate + graceful fallback |

Rejected: separate FastAPI backend (two deploys, CORS), Streamlit (table polish too slow),
static HTML (key leaks to the client).

## Failure modes and responses

| Failure | Response |
|---|---|
| No API key | fallback assessment; chips drive the demo |
| Invalid JSON twice | empty result; chips drive the demo |
| Slow model | chips are always available; never debug past the M2 gate |
| No wifi | `?offline=1`, local run, recorded video |
| "Where do prices come from?" | seeded survey of 6 workshops, 19 Nov, labelled in the UI |
| "Is this legal advice?" | estimates and what to ask; an inspection confirms |
