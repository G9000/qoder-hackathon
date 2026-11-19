import { describe, expect, it } from 'vitest';
import { detectLanguage, scriptedReply } from './language';

describe('detectLanguage', () => {
  it('detects English', () => {
    expect(detectLanguage('My front bumper is dented')).toBe('en');
  });

  it('detects Bahasa Melayu', () => {
    expect(detectLanguage('Bamper depan saya kemek sikit')).toBe('ms');
  });

  it('detects Manglish via particles', () => {
    expect(detectLanguage('My bumper dent lah, can fix or not?')).toBe('manglish');
  });

  it('detects Chinese', () => {
    expect(detectLanguage('我的前保险杠凹了')).toBe('zh');
  });

  it('detects Tamil', () => {
    expect(detectLanguage('என் முன் பம்பர் குழிவாக உள்ளது')).toBe('ta');
  });
});

describe('scriptedReply', () => {
  it('replies in Bahasa Melayu and extracts the damage type', () => {
    const result = scriptedReply({ text: 'Bamper depan saya kemek sikit', make: 'perodua', model: 'Myvi' });
    expect(result.damageType).toBe('front_bumper');
    expect(result.severity).toBe('minor');
    expect(result.reply).toContain('bamper depan');
    expect(result.reply).toContain('minor, sederhana atau teruk');
  });

  it('replies in Manglish when the user uses particles', () => {
    const result = scriptedReply({ text: 'Bumper dent lah, minor only', make: 'perodua', model: 'Myvi' });
    expect(result.damageType).toBe('front_bumper');
    expect(result.reply).toContain('Okay noted');
  });

  it('replies in Chinese', () => {
    const result = scriptedReply({ text: '前保险杠凹了，轻微', make: 'perodua', model: 'Myvi' });
    expect(result.damageType).toBe('front_bumper');
    expect(result.severity).toBe('minor');
    expect(result.reply).toContain('前保险杠');
    expect(result.reply).toContain('轻微');
  });

  it('replies in Tamil', () => {
    const result = scriptedReply({ text: 'முன் பம்பர் குழிவு, லேசானது', make: 'perodua', model: 'Myvi' });
    expect(result.damageType).toBe('front_bumper');
    expect(result.severity).toBe('minor');
    expect(result.reply).toContain('முன் பம்பர்');
    expect(result.reply).toContain('லேசானதா');
  });

  it('sets the safety stop in the user language', () => {
    expect(scriptedReply({ text: 'airbag keluar, kereta tak boleh jalan' }).safetyStop).toBe(true);
    expect(scriptedReply({ text: '安全气囊弹出来了' }).safetyStop).toBe(true);
    expect(scriptedReply({ text: 'ஏர்பேக் வெளியே வந்துவிட்டது' }).safetyStop).toBe(true);
  });

  it('maps cermin sisi to the side mirror, not the windscreen', () => {
    expect(scriptedReply({ text: 'cermin sisi rosak' }).damageType).toBe('side_mirror');
    expect(scriptedReply({ text: 'cermin depan pecah' }).damageType).toBe('windscreen');
  });
});
