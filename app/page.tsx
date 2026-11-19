'use client';

import { useEffect, useMemo, useState } from 'react';
import demoCacheJson from '@/data/demo-cache.json';
import quotesJson from '@/data/quotes.json';
import workshopsJson from '@/data/workshops.json';
import { byWorkshop, matchQuotes } from '@/lib/match';
import { rank, type RankedQuote, type Verdict } from '@/lib/normalize';
import {
  DAMAGE_TYPES,
  MAKES,
  type Assessment,
  type DamageType,
  type Make,
  type Quote,
  type Severity,
  type Workshop,
} from '@/lib/types';

const workshops = workshopsJson as unknown as Workshop[];
const quotes = quotesJson as unknown as Quote[];
const demoCache = demoCacheJson as unknown as Record<DamageType, Assessment>;

const MODELS: Record<Make, string[]> = {
  perodua: ['Myvi', 'Axia', 'Bezza', 'Ativa', 'Alza', 'Aruz', 'Traz'],
  proton: ['Saga', 'Iriz', 'Persona', 'S70', 'X50', 'X70', 'X90', 'Exora'],
  toyota: ['Vios', 'Yaris', 'Hilux', 'Avanza'],
  honda: ['City', 'Jazz', 'Civic', 'HR-V'],
  nissan: ['Almera', 'X-Trail'],
  mazda: ['Mazda 2', 'Mazda 3', 'CX-5'],
  other: ['Other model'],
};

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

const SEVERITIES: Severity[] = ['minor', 'moderate', 'severe'];

const BADGE: Record<Verdict, { label: string; className: string }> = {
  best_value: { label: 'Best value', className: 'border-emerald-300 bg-emerald-100 text-emerald-900' },
  cheapest: { label: 'Cheapest sticker', className: 'border-sky-300 bg-sky-100 text-sky-900' },
  outlier: { label: 'Outlier', className: 'border-amber-400 bg-amber-100 text-amber-900' },
  standard: { label: 'Mid-pack', className: 'border-ink/15 bg-ink/5 text-ink/60' },
};

const rm = (value: number) => `RM${Math.round(value)}`;

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const badge = BADGE[verdict];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function whyFor(row: RankedQuote, best: RankedQuote | undefined, shops: Map<string, Workshop>): string {
  const bestName = best ? shops.get(best.workshopId)?.name ?? 'the best value' : 'the best value';
  if (row.verdict === 'best_value') return 'Lowest effective cost once warranty risk is counted.';
  if (row.verdict === 'cheapest') {
    const warranty = row.warrantyMonths === 0 ? 'no warranty' : `${row.warrantyMonths}-month warranty`;
    const gap = best ? Math.round(row.effectiveCost - best.effectiveCost) : 0;
    return `Cheapest sticker, but ${warranty} — RM${gap} more effective than ${bestName}.`;
  }
  if (row.verdict === 'outlier') return 'About 3× the median. Ask what the extra price covers.';
  const gap = best ? Math.round(row.effectiveCost - best.effectiveCost) : 0;
  return `RM${gap} more effective cost than ${bestName}.`;
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    image.src = url;
  });
}

export default function Home() {
  const [make, setMake] = useState<Make>('perodua');
  const [model, setModel] = useState('Myvi');
  const [damage, setDamage] = useState<DamageType>('front_bumper');
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [photo, setPhoto] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [safetyStop, setSafetyStop] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(new URLSearchParams(window.location.search).get('offline') === '1');
  }, []);

  const shops = useMemo(() => byWorkshop(workshops), []);
  const rows = useMemo(() => rank(matchQuotes(workshops, quotes, make, damage)), [make, damage]);
  const best = rows.find((row) => row.verdict === 'best_value');
  const totalForJob = workshops.filter((workshop) => workshop.damageTypes.includes(damage)).length;
  const stop = safetyStop || assessment?.safetyStop === true;

  function changeMake(next: Make) {
    setMake(next);
    setModel(MODELS[next][0]);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setNotice(null);
    setAssessment(null);
    try {
      const image = await readPhoto(file);
      setPhoto(image);
      if (offline) {
        setAssessment({ ...demoCache[damage], latencyMs: 0 });
        return;
      }
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, make, model }),
      });
      const data = (await response.json()) as Assessment;
      setAssessment(data);
      if (data.damageTypes.length > 0) setDamage(data.damageTypes[0].type);
      else setNotice('No clear damage found. Pick it below.');
    } catch {
      setNotice('Photo could not be read. Pick the damage below.');
    } finally {
      setLoading(false);
    }
  }

  const confidence = assessment?.damageTypes[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-lg font-black text-white">BB</div>
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">Bengkel Baik</h1>
            <p className="text-xs text-ink/60 sm:text-sm">Photo in. Normalised workshop quotes out.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold text-ink/60">
            Demo · seeded prices
          </span>
          {offline && (
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              Offline mode
            </span>
          )}
        </div>
      </header>

      <div className="mt-7 max-w-3xl">
        <p className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          RM800 vs RM780 is not a choice.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70 sm:text-base">
          Those two quotes price different things: part grade, labour, warranty, lead time. Pick your car, show
          the damage, and compare what you actually pay.
        </p>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink/45">1 · Your car</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-ink/60">Make</span>
              <select
                value={make}
                onChange={(event) => changeMake(event.target.value as Make)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand"
              >
                {MAKES.map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink/60">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand"
              >
                {MODELS[make].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h2 className="mt-5 text-[11px] font-bold uppercase tracking-widest text-ink/45">2 · Photo of the damage</h2>
          <label className="mt-3 block cursor-pointer rounded-2xl border-2 border-dashed border-ink/15 bg-paper/60 p-4 transition hover:border-brand/60">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {photo ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Uploaded damage" className="h-20 w-20 rounded-xl object-cover" />
                <div className="min-w-0">
                  {loading ? (
                    <p className="text-sm font-semibold text-ink/60">Reading photo…</p>
                  ) : confidence ? (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Qwen-VL</p>
                      <p className="truncate text-sm font-bold">
                        {DAMAGE_LABEL[confidence.type]} · {Math.round(confidence.confidence * 100)}%
                      </p>
                      {assessment && assessment.damageTypes.length > 1 && (
                        <p className="text-xs text-ink/55">
                          Also: {DAMAGE_LABEL[assessment.damageTypes[1].type]} ·{' '}
                          {Math.round(assessment.damageTypes[1].confidence * 100)}%
                        </p>
                      )}
                      <p className="text-xs text-ink/45">
                        {offline ? 'Cached result' : `${(assessment?.latencyMs ?? 0) / 1000}s`} · tap to change photo
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-ink/60">
                      {loading ? 'Reading photo…' : 'Tap to change photo'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">📷</div>
                <div>
                  <p className="text-sm font-bold">Drop or choose a damage photo</p>
                  <p className="text-xs text-ink/55">
                    {offline ? 'Offline mode uses the demo result — the table still works.' : 'Qwen-VL reads the damage. The chips below work without AI.'}
                  </p>
                </div>
              </div>
            )}
          </label>
          {notice && <p className="mt-2 text-xs font-semibold text-amber-700">{notice}</p>}

          <h2 className="mt-5 text-[11px] font-bold uppercase tracking-widest text-ink/45">3 · What is damaged</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DAMAGE_TYPES.map((item) => {
              const active = damage === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDamage(item)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-ink/15 bg-white text-ink/75 hover:border-ink/30'
                  }`}
                >
                  {DAMAGE_LABEL[item]}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-ink/60">Severity</span>
            <div className="inline-flex overflow-hidden rounded-xl border border-ink/15">
              {SEVERITIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={severity === item}
                  onClick={() => setSeverity(item)}
                  className={`px-3 py-1.5 text-xs font-bold capitalize ${
                    severity === item ? 'bg-ink text-white' : 'bg-white text-ink/60'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl bg-red-50 p-3">
            <input
              type="checkbox"
              checked={safetyStop}
              onChange={(event) => setSafetyStop(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span className="text-xs font-semibold leading-snug text-red-900">
              Airbag deployed, fluid leak, or suspected frame damage. Show the tow warning instead of prices.
            </span>
          </label>
        </div>

        <aside className="min-w-0 rounded-3xl border border-ink/10 bg-ink p-5 text-white">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/45">How we compare</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <p className="font-bold">Part grade</p>
              <p className="text-white/60">OEM, OEM-equivalent, aftermarket, used.</p>
            </li>
            <li>
              <p className="font-bold">Labour and lead time</p>
              <p className="text-white/60">Hours × rate, plus how many days without the car.</p>
            </li>
            <li>
              <p className="font-bold">Warranty risk</p>
              <p className="text-white/60">
                No warranty adds a premium to the effective cost. That is why a RM780 quote can lose to RM800.
              </p>
            </li>
          </ul>
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/45">Where prices come from</p>
            <p className="mt-1 text-sm text-white/75">
              Seeded survey of 6 workshops, 19 Nov 2026. Estimates to compare — not market prices. An inspection
              confirms the repair.
            </p>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              {model} · {DAMAGE_LABEL[damage]}
            </h2>
            <p className="text-xs text-ink/55">
              {offline ? 'Offline: local JSON only. ' : ''}
              {rows.length} of {totalForJob} shops serve this car and job · sorted by effective cost
            </p>
          </div>
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold text-ink/55">
            Severity: {severity}
          </span>
        </div>

        {stop ? (
          <div className="mt-4 rounded-3xl border-2 border-red-300 bg-red-50 p-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-red-700">Safety stop</p>
            <h3 className="mt-1 text-2xl font-black text-red-900 sm:text-3xl">Don&apos;t drive — tow it.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-900/80">
              A deployed airbag, fluid leak, or suspected frame damage needs a physical inspection. Guessing a
              price for this kind of repair is how people get hurt or overcharged.
            </p>
            <p className="mt-3 text-sm font-bold text-red-900">No prices are shown for this result.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] gap-x-4 border-b border-ink/10 bg-paper/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-ink/45 md:grid">
              <span>Workshop</span>
              <span>Total band</span>
              <span>Effective cost</span>
              <span>Part</span>
              <span>Labour</span>
              <span>Warranty</span>
              <span>Lead</span>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink/60">
                No workshop in the seed set serves this car for this job yet. Try another damage type.
              </p>
            ) : (
              <div className="divide-y divide-ink/10">
                {rows.map((row) => {
                  const shop = shops.get(row.workshopId);
                  return (
                    <div
                      key={row.workshopId}
                      className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] md:items-center ${
                        row.isOutlier ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      <div className="col-span-2 min-w-0 md:col-auto">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{shop?.name ?? row.workshopId}</span>
                          <VerdictBadge verdict={row.verdict} />
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-ink/55">
                          {shop?.area} · {whyFor(row, best, shops)}
                        </p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
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
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
                          Effective cost
                        </span>
                        <p className="text-lg font-black leading-tight">{rm(row.effectiveCost)}</p>
                        <p className="text-[10px] text-ink/45">incl. warranty risk</p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
                          Part
                        </span>
                        <p className="text-sm font-semibold">{PART_LABEL[row.partGrade]}</p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
                          Labour
                        </span>
                        <p className="text-sm font-semibold">
                          {row.labourHours} h × {rm(row.labourRatePerHour)}
                        </p>
                        <p className="text-[10px] text-ink/45">= {rm(row.labourHours * row.labourRatePerHour)}</p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
                          Warranty
                        </span>
                        <p className={`text-sm font-semibold ${row.warrantyMonths === 0 ? 'text-red-700' : ''}`}>
                          {row.warrantyMonths === 0 ? 'None' : `${row.warrantyMonths} mo`}
                        </p>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink/35 md:hidden">
                          Lead
                        </span>
                        <p className="text-sm font-semibold">{row.leadTimeDays} d</p>
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
        )}
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink/40">
        <span>Bengkel Baik · hackathon demo · 19 Nov 2026</span>
        <span>Not advice. An inspection confirms the repair.</span>
      </footer>
    </div>
  );
}
