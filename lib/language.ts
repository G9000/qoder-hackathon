import type { DamageType, Severity } from './types';

export type Lang = 'en' | 'ms' | 'manglish' | 'zh' | 'ta';

const HAN = /[\u3400-\u9fff]/;
const TAMIL = /[\u0b80-\u0bff]/;
const MANGLISH = /\b(lah|lor|leh|kan|meh|mah|liao)\b/i;
const MALAY =
  /\b(saya|kereta|bamper|lampu|cermin|kemek|tayar|rosak|sikit|sedikit|teruk|sederhana|parah|bocor|bengkok|casis|nak|tak|boleh|tolong|apa|macam|mana|sudah|belum|depan|sisi|pintu|badan|kena|langgar|pecah|retak|penyok)\b/i;

export function detectLanguage(text: string): Lang {
  if (HAN.test(text)) return 'zh';
  if (TAMIL.test(text)) return 'ta';
  if (MANGLISH.test(text)) return 'manglish';
  if (MALAY.test(text)) return 'ms';
  return 'en';
}

export const DAMAGE_LABEL_I18N: Record<Lang, Record<DamageType, string>> = {
  en: {
    front_bumper: 'front bumper',
    headlamp: 'headlamp',
    windscreen: 'windscreen',
    panel_dent: 'panel dent',
    side_mirror: 'side mirror',
    wheel_tyre: 'wheel or tyre',
  },
  ms: {
    front_bumper: 'bamper depan',
    headlamp: 'lampu depan',
    windscreen: 'cermin depan',
    panel_dent: 'kemek panel',
    side_mirror: 'cermin sisi',
    wheel_tyre: 'tayar atau rim',
  },
  manglish: {
    front_bumper: 'front bumper',
    headlamp: 'headlamp',
    windscreen: 'windscreen',
    panel_dent: 'panel dent',
    side_mirror: 'side mirror',
    wheel_tyre: 'wheel or tyre',
  },
  zh: {
    front_bumper: '前保险杠',
    headlamp: '车头灯',
    windscreen: '挡风玻璃',
    panel_dent: '车身凹陷',
    side_mirror: '侧后视镜',
    wheel_tyre: '轮胎或轮圈',
  },
  ta: {
    front_bumper: 'முன் பம்பர்',
    headlamp: 'முன் விளக்கு',
    windscreen: 'முன் கண்ணாடி',
    panel_dent: 'பேனல் குழிவு',
    side_mirror: 'பக்க கண்ணாடி',
    wheel_tyre: 'டயர் அல்லது வீல்',
  },
};

const VEHICLE_FALLBACK: Record<Lang, string> = {
  en: 'your car',
  ms: 'kereta anda',
  manglish: 'your car',
  zh: '你的车',
  ta: 'உங்கள் கார்',
};

interface Copy {
  safetyStop: (vehicle: string) => string;
  noted: (label: string) => string;
  enough: string;
  askDamage: (vehicle: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    safetyStop: (vehicle) =>
      `That sounds like a safety issue on ${vehicle}. Do not drive — tow it. I will not show prices for airbag, fluid or frame damage.`,
    noted: (label) => `Noted: ${label}. Is it minor, moderate, or severe?`,
    enough: 'Thanks. I have enough to build the report.',
    askDamage: (vehicle) =>
      `Tell me what is damaged on ${vehicle} — bumper, headlamp, windscreen, panel, mirror, or wheel/tyre.`,
  },
  ms: {
    safetyStop: (vehicle) =>
      `Itu nampak macam isu keselamatan pada ${vehicle}. Jangan pandu — tow kereta. Saya tak akan tunjuk harga untuk airbag, kebocoran cecair atau kerosakan casis.`,
    noted: (label) => `Noted: ${label}. Ini minor, sederhana atau teruk?`,
    enough: 'Terima kasih. Maklumat sudah cukup untuk saya bina laporan.',
    askDamage: (vehicle) =>
      `Beritahu saya apa yang rosak pada ${vehicle} — bamper, lampu, cermin depan, panel, cermin sisi, atau tayar/rim.`,
  },
  manglish: {
    safetyStop: (vehicle) =>
      `Wah, that sounds like a safety issue on ${vehicle}. Don't drive — tow it first. I won't show prices for airbag, fluid or frame damage.`,
    noted: (label) => `Okay noted, ${label} ah. Minor, moderate or severe?`,
    enough: 'Can already — I have enough to build the report.',
    askDamage: (vehicle) =>
      `What damage on ${vehicle} ah — bumper, headlamp, windscreen, panel, mirror, or wheel/tyre?`,
  },
  zh: {
    safetyStop: (vehicle) =>
      `${vehicle} 听起来像安全问题。不要开车，叫拖车。气囊、漏液或车架受损，我不会显示价格。`,
    noted: (label) => `明白，${label}。是轻微、中等还是严重？`,
    enough: '谢谢，资料够了，可以生成报告。',
    askDamage: (vehicle) =>
      `告诉我 ${vehicle} 哪里损坏——保险杠、车灯、挡风玻璃、车身凹陷、后视镜，还是轮胎/轮圈？`,
  },
  ta: {
    safetyStop: (vehicle) =>
      `${vehicle} பாதுகாப்பு பிரச்சினையாகத் தெரிகிறது. ஓட்ட வேண்டாம் — டோ செய்யுங்கள். ஏர்பேக், திரவக் கசிவு அல்லது சேசி சேதத்திற்கு விலை காட்ட மாட்டேன்.`,
    noted: (label) => `புரிந்தது: ${label}. லேசானதா, மிதமானதா அல்லது கடுமையானதா?`,
    enough: 'நன்றி. அறிக்கையை உருவாக்க போதுமான தகவல் உள்ளது.',
    askDamage: (vehicle) =>
      `${vehicle} எந்த பகுதி சேதம் — பம்பர், விளக்கு, முன் கண்ணாடி, பேனல் குழிவு, பக்க கண்ணாடி அல்லது டயர்/வீல்?`,
  },
};

const KEYWORDS: [RegExp, DamageType][] = [
  [/bumper|bamper|bumber|保险杠|前杠|பம்பர்/i, 'front_bumper'],
  [/lamp|light|lampu|头灯|车灯|大灯|விளக்கு/i, 'headlamp'],
  [/mirror|cermin sisi|side mirror|后视镜|倒后镜|பக்க கண்ணாடி|மிரர்/i, 'side_mirror'],
  [/windscreen|windshield|cermin|glass|挡风玻璃|风挡|கண்ணாடி|விண்ட்ஷீல்ட்/i, 'windscreen'],
  [/dent|kemek|panel|door|body|pintu|badan|凹陷|凹痕|车身|车门|板金|划痕|刮花|குழி|கதவு|உடல்/i, 'panel_dent'],
  [/tyre|tire|tayar|wheel|rim|轮胎|轮圈|轮毂|车轮|டயர்|சக்கரம்|வீல்|ரிம்/i, 'wheel_tyre'],
];

const SAFETY =
  /airbag|air bag|fluid|leak|frame|chassis|tow|bent|bocor|bengkok|casis|气囊|安全气囊|漏油|漏液|漏水|车架|底盘|拖车|ஏர்பேக்|கசிவு|சேசி|சேஸி|இழுவை|சட்டகம்/i;

const SEVERITY: [RegExp, Severity][] = [
  [/minor|small|light|sikit|sedikit|轻微|小|一点|லேசான|சிறிய|கொஞ்சம்/i, 'minor'],
  [/severe|major|bad|teruk|parah|严重|很糟|重|கடுமையான|மோசமான|பெரிய/i, 'severe'],
  [/moderate|medium|sederhana|中等|中度|மிதமான|நடுத்தர/i, 'moderate'],
];

export interface ScriptedInput {
  text: string;
  make?: string;
  model?: string;
  stage?: string;
}

export interface ScriptedReply {
  reply: string;
  damageType?: DamageType;
  severity?: Severity;
  safetyStop?: true;
}

export function scriptedReply(input: ScriptedInput): ScriptedReply {
  const lang = detectLanguage(input.text);
  const damageType = KEYWORDS.find(([pattern]) => pattern.test(input.text))?.[1];
  const severity = SEVERITY.find(([pattern]) => pattern.test(input.text))?.[1];
  const safetyStop = SAFETY.test(input.text);
  const vehicle = [input.make, input.model].filter(Boolean).join(' ') || VEHICLE_FALLBACK[lang];
  const copy = COPY[lang];

  let reply: string;
  if (safetyStop) {
    reply = copy.safetyStop(vehicle);
  } else if (damageType) {
    reply = copy.noted(DAMAGE_LABEL_I18N[lang][damageType]);
  } else if (input.stage === 'safety') {
    reply = copy.enough;
  } else {
    reply = copy.askDamage(vehicle);
  }

  return {
    reply,
    ...(damageType ? { damageType } : {}),
    ...(severity ? { severity } : {}),
    ...(safetyStop ? { safetyStop: true as const } : {}),
  };
}
