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

type IconName = 'car' | 'arrow' | 'shield' | 'photo' | 'report' | 'check' | 'pin' | 'wrench' | 'spark' | 'table';

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    car: <><path d="m5 9 2-5h10l2 5M3 10l2-1h14l2 1v7H3zM5 17v3m14-3v3M7 13h1m8 0h1" /><path d="M8 4h8" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
    photo: <><path d="M4 7h4l2-3h4l2 3h4v13H4z" /><circle cx="12" cy="13" r="3" /></>,
    report: <><path d="M5 3h10l4 4v14H5zM14 3v5h5M9 12h6m-6 4h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    wrench: <path d="M14 5a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 3 3l5-5a5 5 0 0 0 7-6l-4 3-3-3 3-3Z" />,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 3v4m-2-2h4" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

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
      <div className="rounded-2xl bg-ink p-6 text-white">
        <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Your repair report</p><Icon name="report" className="h-5 w-5 text-[#FFAA78]" /></div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">{cap(make)} {model}</h2>
        <p className="mt-1 text-xs text-white/70">{DAMAGE_LABEL[damage]} · {severity} · {safetyStop ? 'safety stop' : `${rows.length} shops matched`}</p>
        {confidence && <p className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#FFBD96]">AI read: {DAMAGE_LABEL[confidence.type]} · {Math.round(confidence.confidence * 100)}%</p>}
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

      <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
        <SectionTitle n="1" title="Likely faults" />
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

      <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
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
          <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
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
            <div className="mt-4 space-y-2">
              {rows.map((row) => (
                <div key={row.workshopId} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${row.verdict === 'best_value' ? 'border-[#D3E1C8] bg-[#F3F7EF]' : 'border-ink/[0.07]'}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{shops.get(row.workshopId)?.name}</p>
                    <p className="text-[11px] text-ink/50">
                      {row.priceBand[0] && `${rm(row.priceBand[0])}–${rm(row.priceBand[1])} · `}
                      {PART_LABEL[row.partGrade]} · {row.warrantyMonths === 0 ? 'no warranty' : `${row.warrantyMonths} mo`}
                    </p>
                    <p className="mt-1 text-[10px] text-ink/55">estimated · {row.provenance.date} · seeded survey · n = {row.provenance.n}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">{rm(row.effectiveCost)}</span>
                    <VerdictBadge verdict={row.verdict} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
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

          <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
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
        <div className="rounded-2xl border border-ink/[0.08] bg-white p-5">
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
    <h3 className="flex items-center gap-2.5 text-sm font-bold tracking-tight">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FFF0E4] text-[10px] font-bold text-[#AC460D]">{n}</span>
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
  const threadRef = useRef<HTMLDivElement>(null);
  const currentStep = stage === 'car' ? 0 : stage === 'photo' || stage === 'detail' ? 1 : stage === 'safety' ? 2 : 3;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

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
    const id = nextId.current;
    setMessages((current) => [...current, { id, role, text, image }]);
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
    <div className="ui-preview min-h-screen bg-[#F7F6F2]">
      <header className="border-b border-ink/[0.07] bg-white/80">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-[0_4px_12px_#FF5A0025]"><Icon name="wrench" /></div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">bengkel<span className="text-brand">baik</span><span className="text-brand">.</span></p>
              <p className="text-[10px] font-medium tracking-wide text-ink/55">A clearer road to repair</p>
            </div>
          </div>
          <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
            <span className="hidden items-center gap-2 text-xs text-ink/55 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-brand" />{offline ? 'Offline demo' : 'Hackathon preview'}</span>
            <Link href="/classic" className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink/70 transition hover:border-brand/40 hover:text-brand"><Icon name="table" className="h-4 w-4" /><span>Table view</span></Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 pb-8 pt-9 sm:px-8 sm:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#AC460D]">Car trouble, minus the guesswork</p>
            <h1 className="text-[36px] font-extrabold leading-[1.12] tracking-[-0.045em] sm:text-[48px]">A little damage.<br /><span className="text-brand">A clearer next step.</span></h1>
            <p className="mt-4 max-w-[480px] text-sm leading-relaxed text-ink/60">Tell us what happened. Understand the repair, compare workshop estimates, and know what to ask before you pay.</p>
          </div>
          <div className="hidden max-w-[215px] items-start gap-3 pb-1 lg:flex">
            <div className="mt-0.5 rounded-lg bg-[#E9EDE4] p-2 text-[#556442]"><Icon name="shield" className="h-4 w-4" /></div>
            <div><p className="text-xs font-semibold">An informed first step.</p><p className="mt-1 text-xs leading-relaxed text-ink/55">Not a diagnosis. A workshop inspection confirms the repair.</p></div>
          </div>
        </div>

        <ol aria-label="Assessment progress" className="my-7 grid grid-cols-4 overflow-hidden rounded-xl border border-ink/[0.07] bg-white sm:my-8">
          {[
            { label: 'Your car', icon: 'car' },
            { label: 'The damage', icon: 'photo' },
            { label: 'Safety check', icon: 'shield' },
            { label: 'Your report', icon: 'report' },
          ].map((step, index) => (
            <li key={step.label} aria-current={index === currentStep ? 'step' : undefined} className={`flex items-center justify-center gap-2 border-r border-ink/[0.06] px-2 py-3.5 last:border-r-0 sm:justify-start sm:gap-3 sm:px-5 ${index === currentStep ? 'bg-[#FFF4EA]' : ''}`}>
              <span className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:flex ${index < currentStep ? 'bg-[#EAF0E5] text-[#556442]' : index === currentStep ? 'bg-brand text-white' : 'bg-ink/[0.04] text-ink/35'}`}><Icon name={index < currentStep ? 'check' : step.icon as IconName} className="h-4 w-4" /></span>
              <div><p className={`text-[10px] font-bold sm:text-xs ${index === currentStep ? 'text-[#AC460D]' : index < currentStep ? 'text-ink/70' : 'text-ink/50'}`}><span className="mr-1 sm:hidden">{index + 1}.</span>{step.label}</p><p className="mt-0.5 hidden text-[10px] text-ink/50 sm:block">{index < currentStep ? 'Completed' : index === currentStep ? stage === 'report' ? 'Ready to view' : 'You are here' : 'Up next'}</p></div>
            </li>
          ))}
        </ol>

        <div className="grid items-start gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <section aria-label="Repair assistant" className="min-w-0 overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-[0_8px_30px_#14181F04] lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-2 border-b border-ink/[0.07] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0E4] text-brand"><Icon name="spark" className="h-4 w-4" /></div><div><h2 className="text-sm font-bold">Your repair assistant</h2><p className="mt-0.5 text-[11px] text-ink/55">A few questions. A lot more clarity.</p></div></div>
              <span className="rounded-full border border-ink/[0.08] px-2.5 py-1 text-[10px] font-medium text-ink/55">Qwen AI</span>
            </div>

            <div ref={threadRef} role="log" aria-label="Conversation" aria-live="polite" aria-busy={loading} className="chat-thread max-h-[300px] min-h-[170px] space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#FFF0E4] text-brand"><Icon name="spark" className="h-3.5 w-3.5" /></span>}
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-[1.7] ${message.role === 'user' ? 'rounded-tr-sm bg-ink text-white' : 'rounded-tl-sm bg-[#F5F5F1] text-ink/75'}`}>
                    {message.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={message.image} alt="Uploaded damage" className="mb-2 h-24 w-36 rounded-lg object-cover" />
                    )}
                    {message.text}
                  </div>
                </div>
              ))}
              {loading && <p role="status" className="ml-9 flex items-center gap-2 text-xs text-ink/55"><span className="h-2 w-2 animate-pulse rounded-full bg-brand" />Looking into that…</p>}
            </div>

            <div className="px-5 pb-5 sm:px-6">
              <div className="rounded-xl border border-ink/[0.07] bg-[#FAFAF7] p-4">
                {stage === 'car' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2"><Icon name="car" className="h-4 w-4 text-ink/60" /><h3 className="text-xs font-bold">First, let’s meet your car</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-[11px] font-medium text-ink/60">Car make
                        <select aria-label="Make" value={make} onChange={(event) => changeMake(event.target.value as Make)} className="ui-select mt-1.5">
                          {MAKES.map((item) => <option key={item} value={item}>{cap(item)}</option>)}
                        </select>
                      </label>
                      <label className="block text-[11px] font-medium text-ink/60">Car model
                        <select aria-label="Model" value={model} onChange={(event) => setModel(event.target.value)} className="ui-select mt-1.5">
                          {MODELS[make].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="button" onClick={confirmCar} className="ui-primary w-full">Continue with this car<Icon name="arrow" className="h-4 w-4" /></button>
                  </div>
                )}

                {stage === 'photo' && (
                  <div className="space-y-3">
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-brand/35 bg-[#FFF8F1] px-3 py-5 text-center transition hover:bg-[#FFF0E4] focus-within:outline focus-within:outline-2 focus-within:outline-brand">
                      <input type="file" accept="image/*" disabled={loading} aria-label="Upload a damage photo" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
                      <Icon name="photo" className="h-6 w-6 text-brand" /><span className="text-xs font-bold">Upload a damage photo</span><span className="text-[11px] text-ink/55">A clear, close-up photo works best</span>
                    </label>
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="Preview" className="h-16 w-24 rounded-lg object-cover" />
                    )}
                    <p className="text-[11px] font-medium text-ink/55">No photo? Choose the damaged part.</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {DAMAGE_TYPES.map((item) => <button key={item} type="button" disabled={loading} onClick={() => chooseDamage(item)} className="ui-option">{DAMAGE_LABEL[item]}</button>)}
                    </div>
                  </div>
                )}

                {stage === 'detail' && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold">How bad is the damage?</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(['minor', 'moderate', 'severe'] as Severity[]).map((item) => <button key={item} type="button" disabled={loading} onClick={() => chooseSeverity(item)} className="ui-option capitalize">{item}</button>)}
                    </div>
                    {!photo && <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink/15 px-3 py-2.5 text-xs font-semibold text-ink/65 focus-within:outline focus-within:outline-2 focus-within:outline-brand"><input type="file" accept="image/*" disabled={loading} aria-label="Add a photo instead" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /><Icon name="photo" className="h-4 w-4" />Add a photo instead</label>}
                  </div>
                )}

                {stage === 'safety' && (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold"><Icon name="shield" className="h-4 w-4 text-brand" />Before we compare any prices</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => answerSafety(false)} className="ui-option">No safety signs</button>
                      <button type="button" onClick={() => answerSafety(true)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-3 text-xs font-semibold text-red-800 transition hover:bg-red-100">Yes — airbag / fluid / frame</button>
                    </div>
                  </div>
                )}

                {stage === 'ready' && <div className="space-y-2"><button type="button" onClick={generateReport} className="ui-primary w-full">Generate report<Icon name="arrow" className="h-4 w-4" /></button><button type="button" onClick={startOver} className="ui-option w-full">Start over</button></div>}
                {stage === 'report' && <button type="button" onClick={startOver} className="ui-option w-full">Start a new report</button>}
              </div>
            </div>

            <div className="border-t border-ink/[0.07] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white p-1.5 focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10">
                <input aria-label="Message the assistant" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void sendText(); }} placeholder="Or tell us what happened…" className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-base outline-none sm:text-xs" />
                <button type="button" aria-label="Send message" onClick={() => void sendText()} disabled={loading || draft.trim().length === 0} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-white transition hover:bg-ink/80 disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"><Icon name="arrow" className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-center text-[10px] text-ink/50">{offline ? 'Photo assessment uses cached demo results.' : 'Powered by Qwen · You can also use the buttons above.'}</p>
            </div>
          </section>

          <aside aria-label="Your repair report" className="min-w-0">
            {stage === 'report' && damage ? <Report make={make} model={model} damage={damage} severity={severity} safetyStop={safetyStop} assessment={assessment} rows={rows} /> : (
              <div className="overflow-hidden rounded-2xl border border-ink/[0.08] bg-white">
                <div className="relative overflow-hidden border-b border-ink/[0.06] bg-[#EEEEE7] px-6 pb-3 pt-5">
                  <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/55">Your car, your next step</p><span className="rounded-full border border-ink/10 bg-white/60 px-2.5 py-1 text-[10px] font-medium text-ink/60">{cap(make)} {model}</span></div>
                  <svg viewBox="0 0 440 190" fill="none" className="mx-auto mt-2 h-[150px] w-full" aria-hidden="true">
                    <ellipse cx="223" cy="159" rx="157" ry="10" fill="#D5D8CD" />
                    <circle cx="242" cy="89" r="72" stroke="#D9DDD1" strokeDasharray="4 6" />
                    <path d="M61 129 74 105l48-15 36-44q8-8 24-8h87q17 0 27 13l37 48 41 14q13 4 13 17v16H61Z" fill="#FAFBF7" stroke="#596356" strokeWidth="2" />
                    <path d="m135 90 32-40h37v40Zm79-40h49q9 0 14 7l25 33h-88Z" fill="#CCD5C8" stroke="#596356" strokeWidth="1.5" />
                    <path d="M214 95v49M122 96l-10 47m12-42h191M76 127h26m223 0h51M238 105h17" stroke="#8C9586" strokeWidth="1.5" />
                    <path d="m305 90 22 3 5 9h-20Z" fill="#FAFBF7" stroke="#596356" strokeWidth="1.5" />
                    <path d="M67 119h20l-5-9-12 4Zm287-3h21l4 10h-24Z" fill="#F7B780" stroke="#A36C42" />
                    <circle cx="120" cy="145" r="23" fill="#384333" /><circle cx="120" cy="145" r="13" fill="#D4DACD" /><circle cx="120" cy="145" r="5" fill="#929C87" />
                    <circle cx="320" cy="145" r="23" fill="#384333" /><circle cx="320" cy="145" r="13" fill="#D4DACD" /><circle cx="320" cy="145" r="5" fill="#929C87" />
                    <circle cx="78" cy="132" r="19" stroke="#FF5A00" strokeDasharray="3 3" /><path d="m65 134 7-6 4 6 8-8" stroke="#FF5A00" strokeWidth="2" />
                    <path d="M80 107V74H51" stroke="#B1B8A7" strokeDasharray="3 3" /><rect x="23" y="49" width="58" height="24" rx="6" fill="#FAFBF7" stroke="#D6DBCE" /><path d="M34 61h9m7 0h19" stroke="#A1AA96" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#AC460D]"><Icon name="report" className="h-3.5 w-3.5" />Report preview</div>
                  <h2 className="mt-2 text-[22px] font-bold tracking-tight">From “what now?” to a plan.</h2>
                  <p className="mt-2 text-xs leading-relaxed text-ink/55">Your answers turn into a practical repair report. Here’s what you’ll get.</p>
                  <ol className="mt-5 divide-y divide-ink/[0.06]">
                    {[
                      { icon: 'wrench', title: 'Likely faults & required fixes', text: 'Understand what might need attention.' },
                      { icon: 'table', title: 'Comparable repair estimates', text: 'Parts, labour and warranty — not just a price.' },
                      { icon: 'pin', title: 'Workshops that serve your car', text: 'Compare nearby options and contact details.' },
                      { icon: 'report', title: 'One shareable report', text: 'Keep the details together, ready to send.' },
                    ].map((item) => <li key={item.title} className="flex items-start gap-3 py-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F3F4EF] text-[#67725A]"><Icon name={item.icon as IconName} className="h-4 w-4" /></span><div><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-ink/55">{item.text}</p></div></li>)}
                  </ol>
                  <div className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 ${safetyStop ? 'bg-red-50 text-red-800' : 'bg-[#F5F5F1] text-ink/60'}`}><Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-[11px] leading-relaxed">{safetyStop ? 'Safety stop: don’t drive. Your report will show inspection options, without prices.' : 'Safety comes before price. Airbag, fluid or frame damage means tow and inspect — no estimates.'}</p></div>
                </div>
              </div>
            )}
          </aside>
        </div>
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-ink/[0.07] pt-5 text-[10px] text-ink/50"><span>bengkelbaik. · Built for better-informed repairs.</span><span>Hackathon demo · Seeded estimates, not market prices · 19 Nov 2026</span></footer>
      </main>
    </div>
  );
}
