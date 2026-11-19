import type { Metadata } from 'next';
import Link from 'next/link';
import quotesJson from '@/data/quotes.json';
import workshopsJson from '@/data/workshops.json';
import { kbNote, lookupKb } from '@/lib/kb';
import { byWorkshop, matchQuotes } from '@/lib/match';
import { rank, type Verdict } from '@/lib/normalize';
import { parseReport } from '@/lib/report';
import type { DamageType, Quote, Workshop } from '@/lib/types';
import CopyLink from './copy-link';

export const metadata: Metadata = {
  title: 'Bengkel Baik · Damage report',
};

const workshops = workshopsJson as unknown as Workshop[];
const quotes = quotesJson as unknown as Quote[];

const DAMAGE_LABEL: Record<DamageType, string> = {
  front_bumper: 'Front bumper',
  headlamp: 'Headlamp',
  windscreen: 'Windscreen',
  panel_dent: 'Panel dent',
  side_mirror: 'Side mirror',
  wheel_tyre: 'Wheel / tyre',
};

const PART_LABEL: Record<Quote['partGrade'], string> = {
  oem: 'OEM',
  oem_equivalent: 'OEM-equivalent',
  aftermarket: 'Aftermarket',
  used: 'Used',
};

const VERDICT: Record<Verdict, { label: string; className: string; why: string }> = {
  best_value: {
    label: 'Best value',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
    why: 'Lowest effective cost once warranty risk is counted.',
  },
  cheapest: {
    label: 'Cheapest sticker',
    className: 'border-sky-300 bg-sky-100 text-sky-900',
    why: 'Cheapest sticker — check what the warranty covers.',
  },
  outlier: {
    label: 'Outlier',
    className: 'border-amber-400 bg-amber-100 text-amber-900',
    why: 'Well above the median. Ask what the extra price covers.',
  },
  standard: {
    label: 'Mid-pack',
    className: 'border-ink/15 bg-ink/5 text-ink/60',
    why: 'Mid-pack on effective cost.',
  },
};

const rm = (value: number) => `RM${Math.round(value)}`;
const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);
const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;
const mapHref = (shop: Workshop) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.area} Malaysia`)}`;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  const state = parseReport(await searchParams);

  if (!state) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-brand">Bengkel Baik</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">This report link is incomplete.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">
          The link is missing a valid make, model or damage type. Start a new assessment and generate a fresh
          report link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          Start a new assessment
        </Link>
      </main>
    );
  }

  const shops = byWorkshop(workshops);
  const rows = rank(matchQuotes(workshops, quotes, state.make, state.damage));
  const totalForJob = workshops.filter((workshop) => workshop.damageTypes.includes(state.damage)).length;
  const kb = lookupKb(state.make, state.model, state.damage);
  const preparedOn = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-lg font-black text-white">BB</div>
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">Bengkel Baik</h1>
            <p className="text-xs text-ink/60 sm:text-sm">Damage report · shared from chat</p>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/65 transition hover:border-brand hover:text-brand"
        >
          ← New assessment
        </Link>
      </header>

      <section className="mt-8">
        <p className="text-[11px] font-black uppercase tracking-widest text-brand">Damage report</p>
        <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {state.model} · {DAMAGE_LABEL[state.damage]}
        </h2>
        <p className="mt-2 text-sm text-ink/60">
          {titleCase(state.make)} {state.model} · prepared {preparedOn}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 font-semibold text-ink/60">
            Severity: {state.severity}
          </span>
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 font-semibold text-ink/60">
            Seeded estimates · 19 Nov 2026
          </span>
        </div>
      </section>

      {state.safetyStop ? (
        <section className="mt-6 rounded-3xl border-2 border-red-300 bg-red-50 p-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-700">Safety stop</p>
          <h3 className="mt-1 text-2xl font-black text-red-900 sm:text-3xl">Don&apos;t drive — tow it.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-900/80">
            A deployed airbag, fluid leak, or suspected frame damage needs a physical inspection. No prices are
            shown for this result.
          </p>
        </section>
      ) : (
        <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/45">Assessment</h3>
          {state.found.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {state.found.map((item) => (
                <li key={item.type} className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold">{DAMAGE_LABEL[item.type]}</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                    {Math.round(item.confidence * 100)}% confidence
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink/65">
              No damage was detected from the photo — the part was selected manually.
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            Confidence is a model estimate, not a verdict. An inspection confirms the repair.
          </p>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/45">
          Likely cause for the {state.model}
        </h3>
        {kb ? (
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Common causes</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink/75">
                {kb.likelyCauses.map((cause) => (
                  <li key={cause} className="flex gap-2">
                    <span className="text-brand">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45">What the shop should check</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink/75">
                {kb.whatToCheck.map((check) => (
                  <li key={check} className="flex gap-2">
                    <span className="text-brand">•</span>
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/65">
            Not in our knowledge base for the {state.model} yet. A physical inspection decides the cause.
          </p>
        )}
        <div className="mt-4 border-t border-ink/10 pt-3 text-[11px] leading-relaxed text-ink/45">
          <p>{kbNote()}</p>
          {kb && (
            <p className="mt-1">
              Source:{' '}
              <a
                href={kb.source.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink/60 underline underline-offset-2"
              >
                {kb.source.title}
              </a>
            </p>
          )}
        </div>
      </section>

      {!state.safetyStop && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-lg font-black tracking-tight sm:text-xl">Workshop shortlist</h3>
            <p className="text-xs text-ink/55">
              {rows.length} of {totalForJob} shops serve this car and job · sorted by effective cost
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink/60">
                No workshop in the seed set serves this car for this job yet. Try another damage type.
              </p>
            ) : (
              <div className="divide-y divide-ink/10">
                {rows.map((row) => {
                  const shop = shops.get(row.workshopId);
                  const verdict = VERDICT[row.verdict];
                  return (
                    <div
                      key={row.workshopId}
                      className={`grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.8fr)] ${
                        row.isOutlier ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{shop?.name ?? row.workshopId}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${verdict.className}`}
                          >
                            {verdict.label}
                          </span>
                          {shop?.insuranceClaimable && (
                            <span className="inline-flex items-center rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                              ✓ insurance panel
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-ink/55">
                          {shop?.area} · {shop?.distanceKm} km · {verdict.why}
                        </p>
                        {shop && (
                          <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-semibold">
                            <a href={telHref(shop.phone)} className="text-brand underline underline-offset-2">
                              {shop.phone}
                            </a>
                            <a
                              href={mapHref(shop)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand underline underline-offset-2"
                            >
                              Directions ↗
                            </a>
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 sm:hidden">
                          Total band
                        </span>
                        <p className="font-semibold">
                          {rm(row.priceBand[0])}–{rm(row.priceBand[1])}
                        </p>
                        <p className="mt-0.5 inline-flex rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                          estimated · 19 Nov
                        </p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 sm:hidden">
                          Effective cost
                        </span>
                        <p className="text-lg font-black leading-tight">{rm(row.effectiveCost)}</p>
                        <p className="text-[10px] text-ink/45">incl. warranty risk</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs sm:col-span-3">
                        <p>
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35">
                            Part
                          </span>
                          <span className="font-semibold">{PART_LABEL[row.partGrade]}</span>
                        </p>
                        <p>
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35">
                            Labour
                          </span>
                          <span className="font-semibold">
                            {row.labourHours} h × {rm(row.labourRatePerHour)}
                          </span>
                        </p>
                        <p>
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35">
                            Warranty / lead
                          </span>
                          <span className={`font-semibold ${row.warrantyMonths === 0 ? 'text-red-700' : ''}`}>
                            {row.warrantyMonths === 0 ? 'None' : `${row.warrantyMonths} mo`} · {row.leadTimeDays} d
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t border-ink/10 bg-paper/70 px-4 py-3 text-[11px] leading-relaxed text-ink/50">
              Seeded survey · 19 Nov 2026 · n = 6 workshops · Every price is an estimate and labelled. Shops that
              don&apos;t serve this make or job are hidden, not shown with an empty price.
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-brand/30 bg-brand/5 p-5 sm:p-6">
        <h3 className="text-lg font-black tracking-tight">Send this report to the chat</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/65">
          Paste the link back into WhatsApp. It reopens this exact report — assessment, knowledge-base cause,
          shortlist and directions — with no app install.
        </p>
        <CopyLink />
      </section>

      <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/45">Next step</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Call the workshop to confirm stock and the repair date. Appointment booking is the next slice of the
          journey; this report is the hand-off.
        </p>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink/40">
        <span>Bengkel Baik · hackathon demo · 19 Nov 2026</span>
        <span>Not advice. An inspection confirms the repair.</span>
      </footer>
    </main>
  );
}
