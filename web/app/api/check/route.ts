import { NextResponse } from "next/server";
import { runCheck } from "@/lib/check";

export const runtime = "nodejs";
export const maxDuration = 30;

// Simple per-instance limiter so a public demo cannot burn the Gemma quota.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), win = 60_000, max = 12;
  const list = (hits.get(ip) ?? []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many checks in a minute. Wait a moment and try again." }, { status: 429 });
  let body: { text?: unknown; name?: unknown; number?: unknown; state?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Send JSON with a text field." }, { status: 400 }); }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const text = str(body.text, 6000), name = str(body.name, 80), number = str(body.number, 12), state = str(body.state, 2);
  if (!text.trim() && !name.trim() && !number.trim()) return NextResponse.json({ error: "Paste what they sent you, or enter their name or accreditation number." }, { status: 400 });
  try {
    // Nothing the user pastes is stored.
    return NextResponse.json(await runCheck({ text, name, number, state }));
  } catch (e) {
    return NextResponse.json({ error: `The check could not finish: ${(e as Error).message}` }, { status: 500 });
  }
}
