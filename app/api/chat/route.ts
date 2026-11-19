import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DAMAGE_TYPES, type DamageType, type Severity } from '@/lib/types';

export const runtime = 'nodejs';

const inputSchema = z.object({
  text: z.string().min(1).max(500),
  make: z.string().optional(),
  model: z.string().optional(),
  stage: z.string().optional(),
});

const replySchema = z.object({
  reply: z.string().min(1).max(400),
  damageType: z.enum(DAMAGE_TYPES).optional(),
  severity: z.enum(['minor', 'moderate', 'severe']).optional(),
  safetyStop: z.boolean().optional(),
  ready: z.boolean().optional(),
});

type Reply = z.infer<typeof replySchema>;

const LABEL: Record<DamageType, string> = {
  front_bumper: 'front bumper',
  headlamp: 'headlamp',
  windscreen: 'windscreen',
  panel_dent: 'panel dent',
  side_mirror: 'side mirror',
  wheel_tyre: 'wheel or tyre',
};

const KEYWORDS: [RegExp, DamageType][] = [
  [/bumper|bamper/i, 'front_bumper'],
  [/lamp|light|lampu/i, 'headlamp'],
  [/windscreen|windshield|cermin|glass/i, 'windscreen'],
  [/dent|kemek|panel|door|body/i, 'panel_dent'],
  [/mirror|cermin sisi/i, 'side_mirror'],
  [/tyre|tire|tayar|wheel|rim/i, 'wheel_tyre'],
];

const SAFETY = /airbag|air bag|fluid|leak|frame|chassis|tow|bent/i;

const SEVERITY: [RegExp, Severity][] = [
  [/minor|small|light|sikit/i, 'minor'],
  [/severe|major|bad|teruk|heavy/i, 'severe'],
  [/moderate|medium|sederhana/i, 'moderate'],
];

function scripted(input: z.infer<typeof inputSchema>): Reply {
  const damageType = KEYWORDS.find(([pattern]) => pattern.test(input.text))?.[1];
  const severity = SEVERITY.find(([pattern]) => pattern.test(input.text))?.[1];
  const safetyStop = SAFETY.test(input.text);
  const vehicle = [input.make, input.model].filter(Boolean).join(' ') || 'your car';

  let reply: string;
  if (safetyStop) {
    reply = `That sounds like a safety issue on ${vehicle}. Do not drive — tow it. I will not show prices for airbag, fluid or frame damage.`;
  } else if (damageType) {
    reply = `Noted: ${LABEL[damageType]}. Is it minor, moderate, or severe?`;
  } else if (input.stage === 'safety') {
    reply = 'Thanks. I have enough to build the report.';
  } else {
    reply = `Tell me what is damaged on ${vehicle} — bumper, headlamp, windscreen, panel, mirror, or wheel/tyre.`;
  }

  return {
    reply,
    ...(damageType ? { damageType } : {}),
    ...(severity ? { severity } : {}),
    ...(safetyStop ? { safetyStop: true } : {}),
  };
}

async function askModel(input: z.infer<typeof inputSchema>, apiKey: string): Promise<Reply | null> {
  const baseURL = (process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  const provider = createOpenAICompatible({ name: 'dashscope', baseURL, apiKey });
  const system = `You are the intake assistant for a Malaysian car repair quote app.
The user describes visible car damage. You clarify before a report is generated.

Allowed damage types: front_bumper, headlamp, windscreen, panel_dent, side_mirror, wheel_tyre.
Allowed severity: minor, moderate, severe.
If an airbag, fluid leak or possible frame damage is mentioned, set safetyStop true.

Reply with JSON only, in this exact shape:
{"reply":"one short question or acknowledgement","damageType?":"front_bumper","severity?":"moderate","safetyStop?":false,"ready?":false}

Rules:
- At most two short sentences in reply. Plain English.
- Never output a price, a workshop name, or the word "safe".
- Only use the six damage types. If unsure, ask which part is damaged.
- Set ready true when the damage type and severity are known and safetyStop is known.`;

  const { text } = await generateText({
    model: provider(process.env.QWEN_TEXT_MODEL ?? 'qwen-plus'),
    system,
    prompt: JSON.stringify(input),
    temperature: 0.2,
  });

  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = replySchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reply: 'Tell me what is damaged on your car.', latencyMs: 0, source: 'scripted' });
  }

  const input = inputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ reply: 'Tell me what is damaged on your car.', latencyMs: 0, source: 'scripted' });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (apiKey) {
    try {
      const result = await askModel(input.data, apiKey);
      if (result) {
        return NextResponse.json({ ...result, latencyMs: Date.now() - startedAt, source: 'ai' });
      }
    } catch {
      // fall through to the scripted reply
    }
  }

  return NextResponse.json({ ...scripted(input.data), latencyMs: Date.now() - startedAt, source: 'scripted' });
}
