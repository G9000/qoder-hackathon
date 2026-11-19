import { describe, expect, it } from 'vitest';
import { matchQuotes } from './match';
import { rank } from './normalize';
import type { Quote, Workshop } from './types';

const provenance = { source: 'seeded_survey' as const, date: '2026-11-19', n: 6 };

const workshops: Workshop[] = [
  { id: 'ws_A', name: 'A', area: 'PJ', distanceKm: 3, phone: '03-0000 0101', insuranceClaimable: true, coverage: ['perodua', 'proton'], damageTypes: ['front_bumper'], provenance },
  { id: 'ws_B', name: 'B', area: 'Subang', distanceKm: 7, phone: '03-0000 0102', insuranceClaimable: false, coverage: ['all'], damageTypes: ['front_bumper'], provenance },
  { id: 'ws_C', name: 'C', area: 'Glenmarie', distanceKm: 9, phone: '03-0000 0103', insuranceClaimable: true, coverage: ['honda', 'toyota'], damageTypes: ['front_bumper'], provenance },
  { id: 'ws_D', name: 'D', area: 'Puchong', distanceKm: 12, phone: '03-0000 0104', insuranceClaimable: false, coverage: ['all'], damageTypes: ['front_bumper'], provenance },
  { id: 'ws_E', name: 'E', area: 'KL', distanceKm: 7, phone: '03-0000 0105', insuranceClaimable: false, coverage: ['all'], damageTypes: ['front_bumper'], provenance },
  { id: 'ws_F', name: 'F', area: 'Klang', distanceKm: 19, phone: '03-0000 0106', insuranceClaimable: false, coverage: ['perodua', 'proton'], damageTypes: ['front_bumper'], provenance },
];

function quote(
  workshopId: string,
  band: [number, number],
  partGrade: Quote['partGrade'],
  warrantyMonths: number,
  leadTimeDays: number,
): Quote {
  return {
    workshopId,
    damageType: 'front_bumper',
    partGrade,
    priceBand: band,
    labourHours: 3,
    labourRatePerHour: 60,
    warrantyMonths,
    leadTimeDays,
    provenance,
  };
}

const quotes: Quote[] = [
  quote('ws_A', [750, 850], 'oem', 12, 2),
  quote('ws_B', [740, 820], 'aftermarket', 0, 1),
  quote('ws_C', [780, 880], 'oem_equivalent', 6, 2),
  quote('ws_D', [820, 900], 'aftermarket', 3, 1),
  quote('ws_E', [2200, 2400], 'oem', 12, 3),
  quote('ws_F', [790, 875], 'used', 0, 2),
];

describe('normalise ranking', () => {
  it('ranks the OEM warranty quote above the cheaper no-warranty quote', () => {
    const ranked = rank(matchQuotes(workshops, quotes, 'perodua', 'front_bumper'));
    const a = ranked.find((row) => row.workshopId === 'ws_A');
    const b = ranked.find((row) => row.workshopId === 'ws_B');

    expect(a?.verdict).toBe('best_value');
    expect(b?.verdict).toBe('cheapest');
    expect(a!.effectiveCost).toBeLessThan(b!.effectiveCost);
    expect(b!.mid).toBeLessThan(a!.mid);
  });

  it('hides the Honda/Toyota-only shop for a Perodua', () => {
    const matched = matchQuotes(workshops, quotes, 'perodua', 'front_bumper');
    expect(matched.some((row) => row.workshopId === 'ws_C')).toBe(false);

    const forHonda = matchQuotes(workshops, quotes, 'honda', 'front_bumper');
    expect(forHonda.some((row) => row.workshopId === 'ws_C')).toBe(true);
  });

  it('flags the 3x price as an outlier', () => {
    const ranked = rank(matchQuotes(workshops, quotes, 'perodua', 'front_bumper'));
    expect(ranked.find((row) => row.workshopId === 'ws_E')?.isOutlier).toBe(true);
  });
});
