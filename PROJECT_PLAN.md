# Project Plan — "Bengkel Baik" (working title)

**Photo of visible car damage → normalised, comparable quotes from nearby workshops.**

Hackathon: Alibaba Cloud x Developer Kaki QodeFest, 19 Nov 2026.
Tracks: **Digital Inclusion** (price transparency for people who can't afford a wrong
quote) + **Public Good** (consumer protection in a market with no price signal).
Hard deadline: **14:40**.

---

## 1. The problem, in one paragraph

A Malaysian driver with a dented bumper gets one quote from the workshop their cousin
recommends, has no way to know if it is fair, and no way to compare it with another shop,
because **the quotes are not comparable**: one prices OEM parts with a 12-month warranty,
the other prices aftermarket parts with none, one includes labour, one doesn't. Two
numbers with the same currency and nothing else in common. Consumers don't lack
information — they lack a **normalisation layer**.

## 2. What we are building

1. User selects **make + model** (e.g. Perodua Myvi) and uploads a **photo of visible damage**.
2. Qwen-VL classifies **damage type** (6 visible classes) + severity, with confidence.
3. The app filters workshops by **(a) make coverage** and **(b) capability**, then renders
   **ranked, normalised quotes**: price band, part grade, labour hours, warranty, lead time.
4. Ranking uses **effective cost** (mid price + warranty risk premium), not sticker price,
   so the "cheaper" quote can visibly lose.
5. Every price carries provenance (`seeded_survey`, date, n) and an `estimated` chip.
6. Safety rule: airbag / fluid leak / suspected frame damage → *don't drive, tow* —
   no prices shown.

**Not building:** bookings, payments, live workshop APIs, maps, chat history, accounts,
video analysis, hidden-fault diagnosis (noise, brakes, engine). A camera cannot see
those; claiming otherwise is the one thing that loses the room.

## 3. Data model (seed assumption)

Workshops arrive as provided JSON. Two facts per shop matter:

- **`coverage`** — which makes they serve: `["perodua","proton"]` (local only) or
  `["all"]` (multi-marque, e.g. Honda/Toyota too).
- **`damageTypes`** — which of the 6 classes they actually do.

Seed **6 workshops**:

| id | coverage | does | role in demo |
|---|---|---|---|
| ws_A | perodua, proton | all 6 | **best value** (RM800, OEM, 12mo warranty, 2d) |
| ws_B | all | all 6 | **cheapest** (RM780, aftermarket, no warranty, 1d) |
| ws_C | toyota, honda | all 6 | **disappears** when Myvi is selected — coverage filter, visible |
| ws_D | all | not windscreen | capability filter, visible |
| ws_E | all | all 6 | **outlier** (~3× median) — flagged, not silently ranked first |
| ws_F | perodua, proton | bumpers, mirrors, tyres | bulk of the list, keeps the table realistic |

Required scripted pair for `front_bumper`:
`ws_A` RM800 / OEM / 12mo / 2 days **must rank above** `ws_B` RM780 / aftermarket / 0mo.
That single ranking is the pitch.

## 4. Workstreams and tickets

Conventions: one directory per stream, one commit per ticket, ID prefix in the message.
`T0` blocks everyone.

### T0 — Contract freeze (blocking, 5–10 min, 1 person)
`lib/types.ts` exactly as in `AGENT.md` §5. All stream owners acknowledge in chat.
Note the two additions versus the first draft: `coverage: MakeScope[]` and `damageTypes`
on the workshop, plus user-selected `make`/`model` in the request.

### Stream A — Data & logic (1 person, no deps)
- **A1** `data/workshops.json` + `data/quotes.json` — the 6 shops above, 36 quote rows,
  provenance on every record.
- **A2** `lib/match.ts` — coverage + capability filter.
- **A3** `lib/normalize.ts` — mid, risk premium, effective cost, outlier, verdict.
- **A4** unit test: ws_A `best_value`, ws_B `cheapest`; ws_C excluded for `perodua`.

### Stream B — UI (1–2 people, after T0)
- **B1** intake: make/model selects, photo dropzone, 6 damage chips, severity picker.
  Chips work with **no AI** — that is the fallback.
- **B2** quote table: workshop · total band · effective cost · part grade · labour ·
  warranty · lead time · verdict badge. Sorted by effective cost. Projector-legible at
  1280px, no horizontal scroll.
- **B3** trust elements: `estimated · 19 Nov` chip per price, provenance row,
  safety-stop card, "why this ranks first" one-liner per row.
- **B4 (stretch)** clickable car diagram replacing chips. Only after M2.

### Stream C — AI (1 person, after T0)
- **C1** `prompts/assess.ts` — 6-class taxonomy, JSON only, top-2 with confidence,
  non-vehicle → empty, safety flags → `safetyStop`, never a price, never "safe".
- **C2** `app/api/assess/route.ts` — Qwen-VL → zod → one retry → graceful empty result.
- **C3** detection display: labels + confidence beside the photo, chips auto-select.

### Stream D — Demo ops, docs, evidence (1 person, non-blocking)
- **D1** `?offline=1` serving `data/demo-cache.json`; hash-cached sample photos.
  **Verify with wifi physically off.**
- **D2** latency badge + `/health`.
- **D3** deploy only if green before 13:50 (local + video is a valid submission).
- **D4** Qoder evidence, continuously: planning chat, ticket commits, one diff view,
  schema generation screenshot.
- **D5** README + ARCHITECTURE + pitch outline, written by Qoder, including the
  seeded-data sentence.
- **D6** 90s video, one continuous take, kept.

### Stream E — Sample photo set (1 person, 15 minutes, timeboxed)
Goal: **6 images** in `/public/samples/` plus `manifest.json`. Not a dataset. Not a
scraper. A demo carousel.

- **E1** One photo per class: front bumper, headlamp, windscreen, panel dent,
  side mirror, wheel/tyre. Prefer Malaysian cars (Myvi, Saga, Axia, Bezza).
- **E2** Sources, in order of preference: (1) photos taken by a team member — best,
  zero licence risk, and you can shoot them in 5 minutes in the car park; (2) Wikimedia
  Commons (CC-BY / CC0) — record the licence; (3) Unsplash / Pexels — free licence;
  (4) generated images only as a last resort and **labelled as generated**.
  Do **not** scrape random forums or marketplace listings into a public repo.
- **E3** `manifest.json` per image:
  `{ "file": "bumper-myvi.jpg", "expected": { "damageType": "front_bumper", "severity": "moderate" }, "source": "...", "license": "..." }`
- **E4** Record the honest result: **"x/6 classified correctly on first try"** in the
  README. If it's 4/6, say 4/6. Judges respect a measured number and punish an invented one.
- **E5** Also produce **one photo that should trip the safety stop** (deployed airbag or
  fluid on the ground) — the strongest 20 seconds of the demo.

**Why this is deliberately small:** the photo is the front door. Six images with known
labels is enough to prove the classification and to give the demo a guaranteed path.
Spending 45 minutes building an image pipeline is the classic hackathon death.

## 5. Milestones

| # | Time | Gate |
|---|---|---|
| T0 | now | contract frozen, acknowledged |
| **M1** | **13:10** | table renders from local JSON with chips, no AI — already demoable |
| **M2** | **13:35** | photo → damage type, labels visible. **Miss it → cut photo, keep chips** |
| **M3** | **13:50** | normalised ranking + offline mode verified with wifi off |
| **M4** | **14:00** | **FREEZE.** Bugfixes only |
| **M5** | **14:15** | README + ARCHITECTURE + unit test green |
| **M6** | **14:30** | 90s video recorded, evidence folder complete |
| **M7** | **14:40** | submitted |

## 6. Risks and pre-agreed responses

| Risk | Response, decided now |
|---|---|
| Qwen-VL slow or wrong | Chips path is the demo; photo is a bonus. Never debug it past 13:35 |
| API key not working | Escalate at once; the table demo needs no model |
| Wifi dies on stage | `?offline=1` + local run + recorded video |
| "Where do prices come from?" | "Seeded survey of 6 workshops, 19 Nov, labelled in the UI." One sentence |
| "Is this legal / medical advice?" | "We show estimates and what to ask. Inspection confirms." |
| Judges ask about brand detection | "User selects the make. The model classifies damage only — that's the reliable half." |
| Someone wants to add a feature at 13:55 | No |

## 7. Demo script (90 seconds)

1. "A dented bumper. You get one quote, you have no idea if it's fair."
2. Select **Perodua Myvi**, tap **front bumper** → table appears.
   *"Six shops. Note that the Honda specialist is gone — it doesn't serve this car."*
3. Point at **RM800 vs RM780**. *"B looks cheaper. It isn't: aftermarket part, no
   warranty, and this part fails in floods. Normalised, A is the better buy."*
4. Upload a photo → chip auto-selects, label + confidence appear. *"That's Qwen-VL,
   in one call."*
5. Upload the airbag photo → *"Don't drive. Tow it. We show no prices here — because
   guessing a price on structural damage is how people get hurt."*
6. Close: *"Every scan becomes a structured record — damage type, market, part grade,
   price. That's the dataset nobody in Malaysia has. The app is free; the dataset is
   the business."*

## 8. Submission checklist

- [ ] Repo with AGENT.md, README, ARCHITECTURE
- [ ] `npm run build` + `tsc --noEmit` green
- [ ] 90s video (backup if live demo fails)
- [ ] 6 sample photos + manifest in `/public/samples`
- [ ] Qoder evidence: planning screenshots, commit log, one diff
- [ ] Slides: problem → who suffers → demo → normalisation insight → dataset → roadmap
- [ ] One sentence on seeded data, said out loud
