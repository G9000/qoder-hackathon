import { describe, expect, it } from 'vitest';
import { kbNote, lookupKb } from './kb';

describe('vehicle knowledge base', () => {
  it('finds the Myvi front bumper entry', () => {
    const entry = lookupKb('perodua', 'Myvi', 'front_bumper');
    expect(entry?.likelyCauses.length).toBeGreaterThan(0);
    expect(entry?.whatToCheck.length).toBeGreaterThan(0);
    expect(entry?.source.url).toContain('perodua.com.my');
  });

  it('finds the Saga entry regardless of model casing', () => {
    const entry = lookupKb('proton', 'saga', 'wheel_tyre');
    expect(entry?.model).toBe('Saga');
    expect(entry?.source.url).toContain('proton.com');
  });

  it('returns null for a model outside the demo KB', () => {
    expect(lookupKb('honda', 'City', 'front_bumper')).toBeNull();
  });

  it('keeps the curated-KB disclaimer', () => {
    expect(kbNote()).toContain('not a diagnosis');
  });
});
