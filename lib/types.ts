export const MAKES = ['perodua', 'proton', 'toyota', 'honda', 'nissan', 'mazda', 'other'] as const;
export type Make = (typeof MAKES)[number];
export type MakeScope = Make | 'all';

export const DAMAGE_TYPES = [
  'front_bumper',
  'headlamp',
  'windscreen',
  'panel_dent',
  'side_mirror',
  'wheel_tyre',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export type Severity = 'minor' | 'moderate' | 'severe';
export type PartGrade = 'oem' | 'oem_equivalent' | 'aftermarket' | 'used';

export interface Provenance {
  source: 'seeded_survey' | 'phone_confirmed';
  date: string;
  n: number;
}

export interface Workshop {
  id: string;
  name: string;
  area: string;
  coverage: MakeScope[];
  damageTypes: DamageType[];
  provenance: Provenance;
}

export interface Quote {
  workshopId: string;
  damageType: DamageType;
  partGrade: PartGrade;
  priceBand: [number, number];
  labourHours: number;
  labourRatePerHour: number;
  warrantyMonths: number;
  leadTimeDays: number;
  provenance: Provenance;
}

export interface Assessment {
  damageTypes: { type: DamageType; confidence: number }[];
  severity: Severity;
  safetyStop: boolean;
  notes: string;
  latencyMs: number;
}
