import type { DamageType, Make, Quote, Workshop } from './types';

export function workshopServes(workshop: Workshop, make: Make, damageType: DamageType): boolean {
  const coversMake = workshop.coverage.includes('all') || workshop.coverage.includes(make);
  return coversMake && workshop.damageTypes.includes(damageType);
}

export function matchQuotes(
  workshops: Workshop[],
  quotes: Quote[],
  make: Make,
  damageType: DamageType,
): Quote[] {
  const eligible = new Set(
    workshops.filter((workshop) => workshopServes(workshop, make, damageType)).map((workshop) => workshop.id),
  );
  return quotes.filter((quote) => quote.damageType === damageType && eligible.has(quote.workshopId));
}

export function byWorkshop(workshops: Workshop[]): Map<string, Workshop> {
  return new Map(workshops.map((workshop) => [workshop.id, workshop]));
}
