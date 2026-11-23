import crypto from "node:crypto";
import { PROMPT } from "./prompt";
import { parseJsonLoose, sanitize } from "./extract";
import type { Extraction } from "./types";
import cache from "../data/gemma-cache.json";

export const GEMMA_MODEL = process.env.GEMMA_MODEL ?? "gemma-4-31b-it";

export function gemmaConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export const textKey = (t: string) => crypto.createHash("sha256").update(t.trim()).digest("hex").slice(0, 16);

type CacheEntry = { model: string; raw: unknown; ms: number };
const CACHE = cache as Record<string, CacheEntry>;

/** Recorded Gemma output for the built-in examples (demo mode: no key needed, no quota used). */
export function cached(text: string): { x: Extraction; model: string; ms: number } | null {
  const hit = CACHE[textKey(text)];
  return hit ? { x: sanitize(hit.raw, text), model: hit.model, ms: hit.ms } : null;
}

/** Live Gemma call through the Gemini API (Google AI Studio key). */
export async function extractWithGemma(text: string): Promise<{ x: Extraction; model: string; ms: number }> {
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT.replace("{{TEXT}}", text.slice(0, 6000)) }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1200 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Gemma ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { x: sanitize(parseJsonLoose(out), text), model: GEMMA_MODEL, ms: Date.now() - t0 };
}
