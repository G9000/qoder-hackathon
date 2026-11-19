'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import demoCacheJson from '@/data/demo-cache.json';
import quotesJson from '@/data/quotes.json';
import workshopsJson from '@/data/workshops.json';
import { DAMAGE_FIXES } from '@/lib/fixes';
import { byWorkshop, matchQuotes } from '@/lib/match';
import { rank, type RankedQuote, type Verdict } from '@/lib/normalize';
import { buildReportHref } from '@/lib/report';
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

const BADGE: Record<Verdict, { label: string; className: string }> = {
  best_value: { label: 'Best value', className: 'border-emerald-300 bg-emerald-100 text-emerald-900' },
  cheapest: { label: 'Cheapest sticker', className: 'border-sky-300 bg-sky-100 text-sky-900' },
  outlier: { label: 'Outlier', className: 'border-amber-400 bg-amber-100 text-amber-900' },
  standard: { label: 'Mid-pack', className: 'border-ink/15 bg-ink/5 text-ink/60' },
};

const MAP_POINTS: Record<string, { x: number; y: number }> = {
  ws_A: { x: 72, y: 58 },
  ws_B: { x: 148, y: 44 },
  ws_C: { x: 252, y: 62 },
  ws_D: { x: 208, y: 126 },
  ws_E: { x: 104, y: 118 },
  ws_F: { x: 268, y: 138 },
};

const rm = (value: number) => `RM${Math.round(value)}`;
const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

type Stage = 'car' | 'photo' | 'detail' | 'safety' | 'ready' | 'report';
type Msg = { id: number; role: 'assistant' | 'user'; text: string; image?: string };

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
    return `Cheapest sticker, but ${warranty} — RM${Math.round(row.effectiveCost - (best?.effectiveCost ?? row.effectiveCost))} more effective than ${bestName}.`;
  }
  if (row.verdict === 'outlier') return 'About 3× the median. Ask what the extra price covers.';
  return `RM${Math.round(row.effectiveCost - (best?.effectiveCost ?? row.effectiveCost))} more effective cost than ${bestName}.`;
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

function Report({
  make,
  model,
  damage,
  severity,
  safetyStop,
  assessment,
  rows,
}: {
  make: Make;
  model: string;
  damage: DamageType;
  severity: Severity;
  safetyStop: boolean;
  assessment: Assessment | null;
  rows: RankedQuote[];
}) {
  const shops = useMemo(() => byWorkshop(workshops), []);
  const guide = DAMAGE_FIXES[damage];
  const best = rows.find((row) => row.verdict === 'best_value');
  const priced = rows.filter((row) => !row.isOutlier);
  const low = priced.length ? Math.min(...priced.map((row) => row.priceBand[0])) : 0;
  const high = priced.length ? Math.max(...priced.map((row) => row.priceBand[1])) : 0;
  const confidence = assessment?.damageTypes[0];
  const notes = assessment && assessment.damageTypes.length > 0 ? assessment.notes : '';
  const reportHref = buildReportHref({
    make,
    model,
    damage,
    severity,
    safetyStop,
    found: assessment?.damageTypes ?? [],
  });

  return (
    <div id="report" className="space-y-4">
      <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink/45">Damage report</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          {cap(make)} {model}
        </h2>
        <p className="text-sm text-ink/60">
          {DAMAGE_LABEL[damage]} · {severity} · {safetyStop ? 'safety stop' : `${rows.length} shops matched`}
        </p>
        {confidence && (
          <p className="mt-2 inline-flex rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
            AI read: {DAMAGE_LABEL[confidence.type]} · {Math.round(confidence.confidence * 100)}%
          </p>
        )}
      </div>

      {safetyStop && (
        <div className="rounded-3xl border-2 border-red-300 bg-red-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-700">Safety stop</p>
          <h3 className="mt-1 text-2xl font-black text-red-900">Don&apos;t drive — tow it.</h3>
          <p className="mt-2 text-sm leading-relaxed text-red-900/80">
            Airbag, fluid or suspected frame damage needs a physical inspection. No prices are shown for this
            result, because guessing here is how people get hurt or overcharged.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
        <SectionTitle n="1" title="Possible faulty" />
        <ul className="mt-2 space-y-1.5 text-sm text-ink/75">
          {guide.possible.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
        {notes && <p className="mt-2 text-xs text-ink/45">Photo note: {notes}</p>}
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
        <SectionTitle n="2" title="Required fixes" />
        <ul className="mt-2 space-y-1.5 text-sm text-ink/75">
          {guide.fixes.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="font-bold text-brand">→</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink/65">Ask the shop: {guide.ask}</p>
      </div>

      {!safetyStop && (
        <>
          <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
            <SectionTitle n="3" title="Rough quotation" />
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <p className="text-3xl font-black tracking-tight">
                {rm(low)}–{rm(high)}
              </p>
              <p className="pb-1 text-xs text-ink/50">for the shops that serve this car</p>
            </div>
            <p className="mt-1 text-xs text-ink/50">
              Best effective cost {best ? `${rm(best.effectiveCost)} at ${shops.get(best.workshopId)?.name}` : '—'}. Band,
              not a fixed price. Every price is seeded and labelled <span className="font-semibold">estimated · 19 Nov</span>.
            </p>
            <div className="mt-3 divide-y divide-ink/10">
              {rows.map((row) => (
                <div key={row.workshopId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{shops.get(row.workshopId)?.name}</p>
                    <p className="text-[11px] text-ink/50">
                      {row.priceBand[0] && `${rm(row.priceBand[0])}–${rm(row.priceBand[1])} · `}
                      {PART_LABEL[row.partGrade]} · {row.warrantyMonths === 0 ? 'no warranty' : `${row.warrantyMonths} mo`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">{rm(row.effectiveCost)}</span>
                    <VerdictBadge verdict={row.verdict} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
            <SectionTitle n="4" title="Map" />
            <svg viewBox="0 0 320 170" className="mt-2 h-44 w-full rounded-2xl bg-[#EDF1E7]" role="img" aria-label="Seeded workshop map">
              <path d="M0 40 H320 M0 85 H320 M0 130 H320 M80 0 V170 M160 0 V170 M240 0 V170" stroke="#D8DECF" strokeWidth="6" />
              <circle cx="160" cy="85" r="14" fill="#FF5A00" opacity="0.14" />
              <text x="160" y="89" textAnchor="middle" fontSize="9" fontWeight="700" fill="#B33F00">You</text>
              {rows.map((row) => {
                const point = MAP_POINTS[row.workshopId] ?? { x: 160, y: 85 };
                const shop = shops.get(row.workshopId);
                return (
                  <g key={row.workshopId}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={row.verdict === 'best_value' ? 8 : 5}
                      fill={row.verdict === 'best_value' ? '#FF5A00' : '#14181F'}
                    />
                    <text x={point.x + 10} y={point.y + 3} fontSize="8" fill="#14181F">
                      {shop?.area.split(' ')[0]} · {shop?.distanceKm} km
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 text-[11px] text-ink/45">Seeded distances for the demo — no live maps or geolocation.</p>
          </div>

          <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
            <SectionTitle n="5" title="Recommended workshops" />
            <div className="mt-2 divide-y divide-ink/10">
              {rows.map((row, index) => {
                const shop = shops.get(row.workshopId);
                return (
                  <div key={row.workshopId} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        {index + 1}. {shop?.name}
                        <VerdictBadge verdict={row.verdict} />
                        {shop?.insuranceClaimable && (
                          <span className="rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                            ✓ insurance panel
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink/50">
                        {shop?.area} · {shop?.distanceKm} km
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-ink/55">{whyFor(row, best, shops)}</p>
                    </div>
                    {shop?.phone && (
                      <a
                        href={`tel:${shop.phone.replace(/\s/g, '')}`}
                        className="shrink-0 rounded-xl border border-ink/15 px-2.5 py-1.5 text-xs font-bold hover:border-brand"
                      >
                        {shop.phone}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {safetyStop && (
        <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-sm">
          <SectionTitle n="3" title="Inspection shops" />
          <p className="mt-1 text-xs text-ink/50">No prices for a safety stop. Call for an inspection.</p>
          <div className="mt-2 divide-y divide-ink/10">
            {rows.map((row) => {
              const shop = shops.get(row.workshopId);
              return (
                <div key={row.workshopId} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="text-sm font-bold">
                    {shop?.name} <span className="font-normal text-ink/50">· {shop?.area} · {shop?.distanceKm} km</span>
                  </p>
                  {shop?.phone && (
                    <a href={`tel:${shop.phone.replace(/\s/g, '')}`} className="text-xs font-bold underline">
                      {shop.phone}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-ink/45">
        Seeded survey · 19 Nov 2026 · n = 6 workshops. Estimates to compare, not market prices. An inspection
        confirms the repair.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand/25 bg-brand/5 p-5">
        <div>
          <p className="text-sm font-bold">Send this report to the chat</p>
          <p className="mt-1 text-xs leading-snug text-ink/60">
            Shareable link: assessment, vehicle causes, quotes, phone numbers and directions.
          </p>
        </div>
        <a
          href={reportHref}
          className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
        >
          Open shareable report →
        </a>
      </div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white">{n}</span>
      {title}
    </h3>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Hi. Which car are we looking at, and what happened? Pick the car below, then add a photo — or tap the damaged part if you have no photo.',
    },
  ]);
  const [stage, setStage] = useState<Stage>('car');
  const [make, setMake] = useState<Make>('perodua');
  const [model, setModel] = useState('Myvi');
  const [damage, setDamage] = useState<DamageType | null>(null);
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [safetyStop, setSafetyStop] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [offline, setOffline] = useState(false);
  const nextId = useRef(10);

  useEffect(() => {
    setOffline(new URLSearchParams(window.location.search).get('offline') === '1');
  }, []);

  useEffect(() => {
    if (stage === 'report') {
      document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [stage]);

  const rows = useMemo(
    () => (damage ? rank(matchQuotes(workshops, quotes, make, damage)) : []),
    [damage, make],
  );

  function push(role: Msg['role'], text: string, image?: string) {
    nextId.current += 1;
    setMessages((current) => [...current, { id: nextId.current, role, text, image }]);
  }

  function changeMake(next: Make) {
    setMake(next);
    setModel(MODELS[next][0]);
  }

  function confirmCar() {
    push('user', `${cap(make)} ${model}`);
    push('assistant', 'Got it. Add a photo of the damage now — or tap the damaged part below if you do not have one.');
    setStage('photo');
  }

  function chooseDamage(next: DamageType) {
    setDamage(next);
    push('user', DAMAGE_LABEL[next]);
    push('assistant', `Noted: ${DAMAGE_LABEL[next].toLowerCase()}. How bad is it — minor, moderate, or severe?`);
    setStage('detail');
  }

  function chooseSeverity(next: Severity) {
    setSeverity(next);
    push('user', cap(next));
    push(
      'assistant',
      'One safety check: is an airbag deployed, is fluid leaking, or could the frame be bent?',
    );
    setStage('safety');
  }

  function answerSafety(stop: boolean) {
    setSafetyStop(stop);
    push('user', stop ? 'Yes — airbag, fluid or frame damage' : 'No safety signs');
    push(
      'assistant',
      stop
        ? 'That is a safety stop. I will not show prices — the report will say tow and inspect.'
        : 'Thanks — no safety stop. I have enough to build the report.',
    );
    setStage('ready');
  }

  function generateReport() {
    push('assistant', 'Here is your report. Remember: these are seeded estimates, and an inspection confirms the repair.');
    setStage('report');
  }

  function startOver() {
    setMessages([
      {
        id: 1,
        role: 'assistant',
        text: 'Hi. Which car are we looking at, and what happened? Pick the car below, then add a photo — or tap the damaged part if you have no photo.',
      },
    ]);
    setDamage(null);
    setSeverity('moderate');
    setSafetyStop(false);
    setPhoto(null);
    setAssessment(null);
    setStage('car');
  }

  async function handleFile(file: File) {
    setLoading(true);
    push('user', 'Photo of the damage');
    try {
      const image = await readPhoto(file);
      setPhoto(image);
      setMessages((current) => {
        const copy = [...current];
        for (let index = copy.length - 1; index >= 0; index -= 1) {
          if (copy[index].role === 'user' && copy[index].text === 'Photo of the damage') {
            copy[index] = { ...copy[index], image };
            break;
          }
        }
        return copy;
      });

      let result: Assessment;
      if (offline) {
        result = { ...demoCache[damage ?? 'front_bumper'], latencyMs: 0 };
      } else {
        const response = await fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, make, model }),
        });
        result = (await response.json()) as Assessment;
      }
      setAssessment(result);
      const top = result.damageTypes[0];
      if (top) {
        setDamage(top.type);
        push(
          'assistant',
          `I can see ${DAMAGE_LABEL[top.type].toLowerCase()} damage (${Math.round(top.confidence * 100)}%). Is that right? How bad is it — minor, moderate, or severe?`,
        );
        setStage('detail');
      } else {
        push('assistant', 'I could not read that photo clearly. Tap the damaged part below — it works without AI.');
      }
    } catch {
      push('assistant', 'That photo could not be read. Tap the damaged part below — it works without AI.');
    } finally {
      setLoading(false);
    }
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || loading) return;
    setDraft('');
    push('user', text);
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, make, model, stage }),
      });
      const data = (await response.json()) as {
        reply: string;
        damageType?: DamageType;
        severity?: Severity;
        safetyStop?: boolean;
      };
      push('assistant', data.reply);
      if (data.damageType) setDamage(data.damageType);
      if (data.severity) setSeverity(data.severity);
      if (data.safetyStop) {
        setSafetyStop(true);
        setStage('ready');
      } else if (data.damageType) {
        setStage('detail');
      }
    } catch {
      push('assistant', 'I could not reach the assistant. Use the buttons below — they work without AI.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-lg font-black text-white">BB</div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Bengkel Baik</h1>
            <p className="text-xs text-ink/60">Chat. Show the photo. Get a repair report.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {offline && (
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              Offline mode
            </span>
          )}
          <Link
            href="/classic"
            className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold text-ink/60 hover:border-ink/40"
          >
            Classic table view
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <p className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">Tell us what happened.</p>
        <p className="mt-1 max-w-2xl text-sm text-ink/65 sm:text-base">
          We ask a couple of questions, then turn the damage into a comparable report: likely faults, required
          fixes, rough quotes, and the workshops that serve your car.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Bengkel Baik assistant</p>
              <p className="text-sm font-bold">Tell us what happened</p>
            </div>
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand">AI SDK · Qwen</span>
          </div>

          <div className="max-h-[340px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === 'user' ? 'bg-brand text-white' : 'bg-paper text-ink/80'
                  }`}
                >
                  {message.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.image} alt="Uploaded damage" className="mb-2 h-24 w-36 rounded-lg object-cover" />
                  )}
                  {message.text}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs font-semibold text-ink/40">Thinking…</p>}
          </div>

          <div className="border-t border-ink/10 px-4 py-3">
            {stage === 'car' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Make"
                    value={make}
                    onChange={(event) => changeMake(event.target.value as Make)}
                    className="w-full rounded-xl border border-ink/15 px-2.5 py-2 text-sm font-semibold"
                  >
                    {MAKES.map((item) => (
                      <option key={item} value={item}>
                        {cap(item)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full rounded-xl border border-ink/15 px-2.5 py-2 text-sm font-semibold"
                  >
                    {MODELS[make].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={confirmCar} className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white">
                  Continue
                </button>
              </div>
            )}

            {stage === 'photo' && (
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 px-3 py-3 text-sm font-bold hover:border-brand/60">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                  📷 Upload a damage photo
                </label>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Preview" className="h-16 w-24 rounded-lg object-cover" />
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DAMAGE_TYPES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => chooseDamage(item)}
                      className="rounded-xl border border-ink/15 px-2 py-2 text-xs font-semibold hover:border-brand"
                    >
                      {DAMAGE_LABEL[item]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stage === 'detail' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink/50">How bad is it?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['minor', 'moderate', 'severe'] as Severity[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => chooseSeverity(item)}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold capitalize ${
                        severity === item ? 'border-ink bg-ink text-white' : 'border-ink/15 hover:border-brand'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {!photo && (
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-ink/15 px-3 py-2 text-xs font-bold hover:border-brand/60">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                      }}
                    />
                    Add a photo instead
                  </label>
                )}
              </div>
            )}

            {stage === 'safety' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => answerSafety(false)}
                  className="rounded-xl border border-ink/15 px-2 py-2.5 text-xs font-bold hover:border-brand"
                >
                  No safety signs
                </button>
                <button
                  type="button"
                  onClick={() => answerSafety(true)}
                  className="rounded-xl border border-red-300 bg-red-50 px-2 py-2.5 text-xs font-bold text-red-800"
                >
                  Yes — airbag / fluid / frame
                </button>
              </div>
            )}

            {stage === 'ready' && (
              <div className="space-y-2">
                <button type="button" onClick={generateReport} className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white">
                  Generate report
                </button>
                <button type="button" onClick={startOver} className="w-full rounded-xl border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/60">
                  Start over
                </button>
              </div>
            )}

            {stage === 'report' && (
              <button type="button" onClick={startOver} className="w-full rounded-xl border border-ink/15 px-3 py-2.5 text-xs font-semibold text-ink/60">
                New report
              </button>
            )}

            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void sendText();
                }}
                placeholder="Type the damage, e.g. bumper dent"
                className="min-w-0 flex-1 rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendText()}
                disabled={loading || draft.trim().length === 0}
                className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="min-w-0">
          {stage === 'report' && damage ? (
            <Report
              make={make}
              model={model}
              damage={damage}
              severity={severity}
              safetyStop={safetyStop}
              assessment={assessment}
              rows={rows}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-ink/20 bg-white/50 p-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink/40">Report preview</p>
              <h2 className="mt-2 text-xl font-black tracking-tight">Five answers, one screen.</h2>
              <ol className="mt-4 space-y-3 text-sm text-ink/65">
                {['Possible faulty', 'Required fixes', 'Rough quotation', 'Map', 'Recommended workshops'].map((item, index) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="font-semibold">{item}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs leading-relaxed text-ink/45">
                Answer the questions on the left. The report appears here. Safety questions are asked before
                any price is shown.
              </p>
            </div>
          )}
        </aside>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink/40">
        <span>Bengkel Baik · hackathon demo · 19 Nov 2026</span>
        <span>Not advice. An inspection confirms the repair.</span>
      </footer>
    </div>
  );
}
