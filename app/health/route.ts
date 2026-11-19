import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({
    ok: true,
    model: process.env.QWEN_VL_MODEL ?? 'qwen-vl-plus',
    apiKeyConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    offlineMode: 'enabled via ?offline=1',
  });
}
