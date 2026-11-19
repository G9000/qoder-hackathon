import { DAMAGE_TYPES, MAKES, type DamageType, type Make, type Severity } from './types';

export interface FoundDamage {
  type: DamageType;
  confidence: number;
}

export interface ReportState {
  make: Make;
  model: string;
  damage: DamageType;
  severity: Severity;
  safetyStop: boolean;
  found: FoundDamage[];
}

const SEVERITIES: Severity[] = ['minor', 'moderate', 'severe'];
const MODEL_PATTERN = /^[A-Za-z0-9 .-]{1,40}$/;

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function buildReportHref(state: ReportState): string {
  const params = new URLSearchParams();
  params.set('make', state.make);
  params.set('model', state.model);
  params.set('damage', state.damage);
  params.set('severity', state.severity);
  if (state.safetyStop) params.set('stop', '1');
  if (state.found.length > 0) {
    const found = state.found
      .slice(0, 2)
      .map((item) => `${item.type}:${clampConfidence(item.confidence).toFixed(2)}`)
      .join(',');
    params.set('found', found);
  }
  return `/report?${params.toString()}`;
}

export function parseReport(input: Record<string, string | string[] | undefined>): ReportState | null {
  const pick = (key: string): string | undefined => {
    const value = input[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const make = pick('make');
  const model = pick('model');
  const damage = pick('damage');
  const severity = pick('severity') ?? 'moderate';

  if (!make || !MAKES.includes(make as Make)) return null;
  if (!model || !MODEL_PATTERN.test(model)) return null;
  if (!damage || !DAMAGE_TYPES.includes(damage as DamageType)) return null;
  if (!SEVERITIES.includes(severity as Severity)) return null;

  const found = (pick('found') ?? '')
    .split(',')
    .slice(0, 2)
    .map((pair) => {
      const [type, raw] = pair.split(':');
      if (!type || !DAMAGE_TYPES.includes(type as DamageType)) return null;
      const confidence = Number(raw);
      if (!Number.isFinite(confidence)) return null;
      return { type: type as DamageType, confidence: clampConfidence(confidence) };
    })
    .filter((item): item is FoundDamage => item !== null);

  return {
    make: make as Make,
    model: model.trim(),
    damage: damage as DamageType,
    severity: severity as Severity,
    safetyStop: pick('stop') === '1',
    found,
  };
}
