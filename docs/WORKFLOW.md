# End-to-end workflow

Status as of 19 Nov 2026. Legend: **built** = in this repo; **planned** = v2 or lives in
the separate WhatsApp workspace.

```mermaid
flowchart TD
  classDef input fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
  classDef built fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
  classDef planned fill:#fff8e1,stroke:#f9a825,color:#5d4037,stroke-dasharray:5 5
  classDef stop fill:#ffebee,stroke:#c62828,color:#b71c1c
  classDef report fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c

  subgraph CH["1 · CHANNELS"]
    WEB["Web intake"]:::input
    WAT["WhatsApp text: 1-6, make, q, reset"]:::planned
    WAI["WhatsApp image"]:::planned
    WAV["WhatsApp voice note"]:::planned
  end

  WAV --> ASR{"ASR key set?"}:::planned
  ASR -->|"No"| ASRNO["Reply: transcription not configured - send text or photo"]:::planned
  ASR -->|"Yes"| ASRT["qwen3-asr-flash transcription"]:::planned
  ASRT --> PART["Part-word extraction, English + Malay"]:::planned
  PART --> CONFIRM
  WAT --> CONFIRM

  WAI --> PHOTO
  WEB --> PHOTO["Photo upload (optional)"]:::built
  WEB --> CHIPS["Damage chips + severity"]:::built
  CHIPS --> CONFIRM["Confirm make + model + severity"]:::built

  subgraph A["2 · ASSESSMENT"]
    PHOTO --> MODE{"offline=1 or no API key?"}:::built
    MODE -->|"Yes"| CACHE["demo-cache.json"]:::built
    MODE -->|"No"| API["POST /api/assess -> Qwen-VL"]:::built
    API --> OK{"Schema-valid JSON?"}:::built
    OK -->|"Yes"| RESULT["0-2 damage types + confidence + severity + safetyStop + suspectedMake hint"]:::built
    OK -->|"No"| RETRY["Retry once with repair hint"]:::built
    RETRY --> OK2{"Valid on retry?"}:::built
    OK2 -->|"Yes"| RESULT
    OK2 -->|"No"| FALLBACK["Fallback: no damage, manual selection"]:::built
    API -->|"API / network error"| FALLBACK
    CACHE --> RESULT
  end

  RESULT --> FOUND{"Damage detected?"}:::built
  FOUND -->|"No"| MANUAL["No clear damage - pick from chips"]:::built
  FOUND -->|"Yes"| SHOW["Show label + confidence; auto-select chips"]:::built

  MANUAL --> CLAR
  SHOW --> CLAR{"Image-only intake?"}:::planned
  CLAR -->|"Yes"| ASK["Ask make/model + owner-known defects"]:::planned
  CLAR -->|"No"| SAFE
  ASK --> SAFE["Check safety stop (model + user checkbox)"]:::built

  SAFE -->|"Airbag, fluid leak, frame damage"| STOP["Don't drive - tow. No prices."]:::stop
  SAFE -->|"Clear"| MATCH["match.ts: coverage (make or all) + damage type"]:::built

  MATCH --> ANY{"Any matching workshop?"}:::built
  ANY -->|"No"| NOMATCH["No shop for this car/job - try another damage type"]:::built
  ANY -->|"Yes"| RANK["normalize.ts: mid price + warranty risk = effective cost"]:::built
  RANK --> VERDICT["Verdicts: best value / cheapest / outlier / mid-pack"]:::built

  STOP --> LINKGEN
  NOMATCH --> LINKGEN
  VERDICT --> LINKGEN["Build validated /report link from state"]:::report

  LINKGEN --> KB{"KB entry for make + model + damage?"}:::built
  KB -->|"Yes"| KBYES["Likely causes + what to check + owner's manual source"]:::built
  KB -->|"No"| KBNO["Not in KB - physical inspection decides"]:::built

  LINKGEN --> SHARE["Copy link / chat adapter sends it"]:::report
  SHARE --> VALID{"Valid report link?"}:::built
  VALID -->|"No"| INVALID["Incomplete link page -> new assessment"]:::built
  VALID -->|"Yes"| VIEW["Report: assessment, KB, shortlist, phone, directions"]:::report
  KBYES --> VIEW
  KBNO --> VIEW
  STOP --> VIEW
  NOMATCH --> VIEW

  VIEW --> NEXT{"Workshop chosen?"}:::built
  NEXT -->|"No"| CALL["Call workshop to confirm stock and date"]:::built
  NEXT -->|"v2: appointment"| BOOK["Pick appointment date"]:::planned
  BOOK --> BOOKED["Booking confirmed"]:::planned
  BOOKED --> APPLINK["Appointment link: report + location + directions"]:::planned

  subgraph L["LEGEND"]
    B["Built"]:::built
    P["Planned / other workspace"]:::planned
    S["Safety stop"]:::stop
  end
```

## Outcome matrix

| Stage | Outcome | Behaviour |
|---|---|---|
| Assessment | 1–2 damage types returned | Label + confidence shown, chips auto-selected |
| Assessment | No damage detected | "No clear damage found. Pick it below." |
| Assessment | Invalid JSON twice | `damageTypes: []`, manual selection |
| Assessment | API / network error | Same manual-selection fallback, no crash |
| Assessment | `?offline=1` or no API key | Cached assessment from `data/demo-cache.json` |
| Safety | Airbag / fluid / frame signal | Tow warning, no prices rendered |
| Matching | No eligible workshop | Explicit message, try another damage type |
| Matching | Eligible workshops | Ranked by effective cost with four verdicts |
| Knowledge base | Myvi / Saga entry exists | Likely causes + inspection checks + manual source |
| Knowledge base | Model outside the KB | "Not in our knowledge base" fallback |
| Report link | Valid state | Full report with phone and directions |
| Report link | Invalid state | Recovery page back to a new assessment |

## Where each piece lives

| Piece | File |
|---|---|
| Intake, chips, quote table | `app/page.tsx` |
| Assessment API | `app/api/assess/route.ts` |
| Matching | `lib/match.ts` |
| Ranking | `lib/normalize.ts` |
| Knowledge base data / lookup | `data/vehicle-kb.json`, `lib/kb.ts` |
| Shareable report state | `lib/report.ts` |
| Report page | `app/report/page.tsx` |
| Copy-link control | `app/report/copy-link.tsx` |

## Share-link contract

`/report?make=<make>&model=<model>&damage=<damage>&severity=<severity>&stop=1&found=<type:conf,...>`

- Validated against `MAKES`, `DAMAGE_TYPES` and `SEVERITIES`; invalid links show a
  recovery page.
- `found` is capped at two entries; confidence is clamped to 0–1.
- Prices are not encoded — they are recomputed deterministically from the seeded data,
  so the link cannot drift from the quote table.

## Not built (planned)

- WhatsApp bot (`bot/whatsapp.mjs`) lives in a separate workspace; it is an I/O-only
  adapter that calls the same `/api/assess`. No workflow platform, SDK or agent runtime.
- Image-only clarification loop (make/model + owner-known defects).
- Appointment booking and appointment link.
- Vehicle KB beyond Perodua Myvi and Proton Saga.

## Manual sources

- Perodua Myvi e-Owner's Manual: <https://eownersmanual.perodua.com.my/ourcars/>
- PROTON Saga Owner's Manual: <https://www.proton.com/after-sales/owners-manual/saga>

The KB is curated seed data, not a diagnosis. Likely causes are common impact/wear
patterns; the inspection checklist is the part intended to be grounded in the manual.
