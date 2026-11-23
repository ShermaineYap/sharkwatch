import { NextResponse } from "next/server";
import { snowflakeConfigured } from "@/lib/snowflake";
import { gemmaConfigured, GEMMA_MODEL } from "@/lib/gemma";
import { store } from "@/lib/check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = store();
  let roster: { store: string; snapshot?: string; error?: string } = { store: s.name };
  try { roster.snapshot = await s.snapshot(); } catch (e) { roster = { ...roster, error: (e as Error).message.slice(0, 200) }; }
  return NextResponse.json({ ok: !roster.error, gemma: { configured: gemmaConfigured(), model: GEMMA_MODEL }, snowflake: { configured: snowflakeConfigured() }, roster });
}
