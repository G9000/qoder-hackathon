import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { detectLanguage, scriptedReply } from '@/lib/language';
import { DAMAGE_TYPES } from '@/lib/types';

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

function scripted(input: z.infer<typeof inputSchema>): Reply {
  return scriptedReply(input);
}

async function askModel(input: z.infer<typeof inputSchema>, apiKey: string): Promise<Reply | null> {
  const baseURL = (process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  const provider = createOpenAICompatible({ name: 'dashscope', baseURL, apiKey });
  const system = `You are the intake assistant for a Malaysian car repair quote app.
The user describes visible car damage. You clarify before a report is generated.

Language:
- Reply in the user's language and register: English, Bahasa Melayu, Mandarin Chinese (Simplified), Tamil or Manglish.
- Manglish means Malaysian English mixed with Malay words and particles such as lah, lor, kan and "already". Mirror the user's mix.
- If the user mixes languages, reply in the same mix. If unsure, use the language code given in the input.
- JSON field values never translate: damageType, severity and the booleans stay English.
- Safety-stop wording must stay unambiguous in every language: do not drive, tow the car.

Allowed damage types: front_bumper, headlamp, windscreen, panel_dent, side_mirror, wheel_tyre.
Allowed severity: minor, moderate, severe.
If an airbag, fluid leak or possible frame damage is mentioned, set safetyStop true.

Reply with JSON only, in this exact shape:
{"reply":"one short question or acknowledgement","damageType?":"front_bumper","severity?":"moderate","safetyStop?":false,"ready?":false}

Rules:
- At most two short sentences in reply, written in the user's language.
- Never output a price, a workshop name, or the word "safe".
- Only use the six damage types. If unsure, ask which part is damaged.
- Set ready true when the damage type and severity are known and safetyStop is known.`;

  const { text } = await generateText({
    model: provider(process.env.QWEN_TEXT_MODEL ?? 'qwen-plus'),
    system,
    prompt: JSON.stringify({ ...input, language: detectLanguage(input.text) }),
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
