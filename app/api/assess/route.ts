import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DAMAGE_TYPES } from '@/lib/types';
import { SYSTEM_PROMPT } from '@/prompts/assess';

export const runtime = 'nodejs';

const inputSchema = z.object({
  image: z.string().min(32),
  make: z.string().optional(),
  model: z.string().optional(),
});

const resultSchema = z.object({
  damageTypes: z
    .array(
      z.object({
        type: z.enum(DAMAGE_TYPES),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(2),
  severity: z.enum(['minor', 'moderate', 'severe']),
  safetyStop: z.boolean(),
  notes: z.string().max(300),
});

type Result = z.infer<typeof resultSchema>;

const FALLBACK: Result = {
  damageTypes: [],
  severity: 'moderate',
  safetyStop: false,
  notes: 'manual selection',
};

function parse(raw: string): Result | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = resultSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function askModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  image: string,
  vehicle: string,
  repairHint?: string,
): Promise<string | null> {
  const messages: unknown[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: `Vehicle: ${vehicle}. Return the JSON object only.` },
      ],
    },
  ];
  if (repairHint) {
    messages.push({ role: 'assistant', content: repairHint });
    messages.push({ role: 'user', content: 'That reply was not valid. Return only the JSON object.' });
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ...FALLBACK, latencyMs: Date.now() - startedAt });
  }

  const input = inputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ ...FALLBACK, latencyMs: Date.now() - startedAt });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...FALLBACK, latencyMs: Date.now() - startedAt });
  }

  const baseUrl = (process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  const model = process.env.QWEN_VL_MODEL ?? 'qwen-vl-plus';
  const vehicle = [input.data.make, input.data.model].filter(Boolean).join(' ') || 'unknown vehicle';

  try {
    const first = await askModel(baseUrl, apiKey, model, input.data.image, vehicle);
    let result = first ? parse(first) : null;
    if (!result && first) {
      const second = await askModel(baseUrl, apiKey, model, input.data.image, vehicle, first);
      result = second ? parse(second) : null;
    }
    return NextResponse.json({ ...(result ?? FALLBACK), latencyMs: Date.now() - startedAt });
  } catch {
    return NextResponse.json({ ...FALLBACK, latencyMs: Date.now() - startedAt });
  }
}
