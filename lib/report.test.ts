import { describe, expect, it } from 'vitest';
import { buildReportHref, parseReport, type ReportState } from './report';

const state: ReportState = {
  make: 'perodua',
  model: 'Myvi',
  damage: 'front_bumper',
  severity: 'moderate',
  safetyStop: false,
  found: [
    { type: 'front_bumper', confidence: 0.86 },
    { type: 'panel_dent', confidence: 0.31 },
  ],
};

describe('report link', () => {
  it('round-trips a report state through the URL', () => {
    const href = buildReportHref(state);
    const query = Object.fromEntries(new URLSearchParams(href.split('?')[1]));
    expect(parseReport(query)).toEqual(state);
  });

  it('keeps the safety stop flag', () => {
    const href = buildReportHref({ ...state, safetyStop: true });
    const query = Object.fromEntries(new URLSearchParams(href.split('?')[1]));
    expect(parseReport(query)?.safetyStop).toBe(true);
  });

  it('rejects an unknown make or damage type', () => {
    expect(parseReport({ make: 'tesla', model: 'Model 3', damage: 'front_bumper' })).toBeNull();
    expect(parseReport({ make: 'perodua', model: 'Myvi', damage: 'engine' })).toBeNull();
  });

  it('clamps confidence and caps found damage at two entries', () => {
    const parsed = parseReport({
      make: 'proton',
      model: 'Saga',
      damage: 'headlamp',
      severity: 'minor',
      found: 'headlamp:2,panel_dent:0.5,windscreen:0.9',
    });
    expect(parsed?.found).toEqual([
      { type: 'headlamp', confidence: 1 },
      { type: 'panel_dent', confidence: 0.5 },
    ]);
  });
});
