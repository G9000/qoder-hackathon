import kbJson from '../data/vehicle-kb.json';
import type { DamageType, Make } from './types';

export interface KbSource {
  title: string;
  url: string;
}

export interface KbEntry {
  make: Make;
  model: string;
  damageType: DamageType;
  likelyCauses: string[];
  whatToCheck: string[];
  source: KbSource;
}

export interface VehicleKb {
  note: string;
  entries: KbEntry[];
}

const kb = kbJson as VehicleKb;

export function lookupKb(make: Make, model: string, damageType: DamageType): KbEntry | null {
  const normalized = model.trim().toLowerCase();
  return (
    kb.entries.find(
      (entry) =>
        entry.make === make &&
        entry.model.toLowerCase() === normalized &&
        entry.damageType === damageType,
    ) ?? null
  );
}

export function kbNote(): string {
  return kb.note;
}
