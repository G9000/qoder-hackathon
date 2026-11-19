import { mkdirSync, writeFileSync } from 'node:fs';

const date = '2026-11-19';
const provenance = { source: 'seeded_survey', date, n: 6 };

const ALL = ['front_bumper', 'headlamp', 'windscreen', 'panel_dent', 'side_mirror', 'wheel_tyre'];

const workshops = [
  {
    id: 'ws_A',
    name: 'Ah Seng Auto',
    area: 'Petaling Jaya',
    distanceKm: 3.2,
    phone: '03-0000 0101',
    insuranceClaimable: true,
    coverage: ['perodua', 'proton'],
    damageTypes: ALL,
  },
  {
    id: 'ws_B',
    name: 'JB Motorworks',
    area: 'Subang Jaya',
    distanceKm: 6.8,
    phone: '03-0000 0102',
    insuranceClaimable: false,
    coverage: ['all'],
    damageTypes: ALL,
  },
  {
    id: 'ws_C',
    name: 'Honda-Toyota Specialist',
    area: 'Glenmarie',
    distanceKm: 9.4,
    phone: '03-0000 0103',
    insuranceClaimable: true,
    coverage: ['toyota', 'honda'],
    damageTypes: ALL,
  },
  {
    id: 'ws_D',
    name: 'Din Auto Service',
    area: 'Puchong',
    distanceKm: 12.6,
    phone: '03-0000 0104',
    insuranceClaimable: false,
    coverage: ['all'],
    damageTypes: ALL.filter((type) => type !== 'windscreen'),
  },
  {
    id: 'ws_E',
    name: 'Premium Auto KL',
    area: 'Sri Petaling',
    distanceKm: 7.1,
    phone: '03-0000 0105',
    insuranceClaimable: false,
    coverage: ['all'],
    damageTypes: ALL,
  },
  {
    id: 'ws_F',
    name: 'Kedai Pak Ali',
    area: 'Klang',
    distanceKm: 18.9,
    phone: '03-0000 0106',
    insuranceClaimable: false,
    coverage: ['perodua', 'proton'],
    damageTypes: ['front_bumper', 'side_mirror', 'wheel_tyre'],
  },
].map((workshop) => ({ ...workshop, provenance }));

// [low, high, partGrade, warrantyMonths, leadTimeDays, labourHours, labourRate]
const rows = {
  front_bumper: {
    ws_A: [750, 850, 'oem', 12, 2, 3, 55],
    ws_B: [740, 820, 'aftermarket', 0, 1, 3, 65],
    ws_C: [780, 880, 'oem_equivalent', 6, 2, 3, 65],
    ws_D: [820, 900, 'aftermarket', 3, 1, 2.5, 50],
    ws_E: [2200, 2400, 'oem', 12, 3, 4, 120],
    ws_F: [790, 875, 'used', 0, 2, 2.5, 55],
  },
  headlamp: {
    ws_A: [900, 1100, 'oem', 12, 2, 2, 55],
    ws_B: [700, 850, 'aftermarket', 0, 1, 2, 65],
    ws_C: [850, 1000, 'oem_equivalent', 6, 2, 2.5, 65],
    ws_D: [600, 720, 'aftermarket', 3, 1, 1.5, 50],
    ws_E: [2600, 3000, 'oem', 12, 3, 3, 120],
  },
  windscreen: {
    ws_A: [650, 790, 'oem', 12, 2, 1.5, 55],
    ws_B: [600, 720, 'aftermarket', 0, 1, 1.5, 65],
    ws_C: [700, 820, 'oem_equivalent', 6, 2, 1.5, 65],
    ws_E: [1800, 2100, 'oem', 12, 3, 2, 120],
  },
  panel_dent: {
    ws_A: [350, 450, 'oem', 12, 2, 2, 55],
    ws_B: [300, 380, 'aftermarket', 0, 1, 2, 65],
    ws_C: [330, 420, 'oem_equivalent', 6, 2, 2, 65],
    ws_D: [280, 350, 'aftermarket', 3, 1, 1.5, 50],
    ws_E: [900, 1100, 'oem', 12, 2, 2, 120],
  },
  side_mirror: {
    ws_A: [220, 300, 'oem', 12, 1, 0.5, 55],
    ws_B: [180, 240, 'aftermarket', 0, 1, 0.5, 65],
    ws_C: [200, 280, 'oem_equivalent', 6, 1, 0.5, 65],
    ws_D: [170, 220, 'aftermarket', 3, 1, 0.5, 50],
    ws_E: [650, 800, 'oem', 12, 2, 0.5, 120],
    ws_F: [190, 250, 'used', 0, 1, 0.5, 55],
  },
  wheel_tyre: {
    ws_A: [280, 380, 'oem', 12, 1, 0.5, 55],
    ws_B: [220, 300, 'aftermarket', 0, 1, 0.5, 65],
    ws_C: [250, 340, 'oem_equivalent', 6, 1, 0.5, 65],
    ws_D: [200, 260, 'aftermarket', 3, 1, 0.5, 50],
    ws_E: [700, 900, 'oem', 12, 2, 1, 120],
    ws_F: [210, 280, 'used', 0, 1, 0.5, 55],
  },
};

const quotes = [];
for (const [damageType, byShop] of Object.entries(rows)) {
  for (const [workshopId, values] of Object.entries(byShop)) {
    const [low, high, partGrade, warrantyMonths, leadTimeDays, labourHours, labourRatePerHour] = values;
    quotes.push({
      workshopId,
      damageType,
      partGrade,
      priceBand: [low, high],
      labourHours,
      labourRatePerHour,
      warrantyMonths,
      leadTimeDays,
      provenance,
    });
  }
}

mkdirSync('data', { recursive: true });
writeFileSync('data/workshops.json', JSON.stringify(workshops, null, 2) + '\n');
writeFileSync('data/quotes.json', JSON.stringify(quotes, null, 2) + '\n');
console.log(`Wrote ${workshops.length} workshops and ${quotes.length} quotes.`);
