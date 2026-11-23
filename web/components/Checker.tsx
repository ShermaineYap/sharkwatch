"use client";
import { useRef, useState } from "react";
import type { CheckResult, Verification } from "@/lib/types";

export interface Example { label: string; text: string; source: string }

const WORD: Record<CheckResult["verdict"], string> = { red: "STOP", amber: "CHECK", green: "NO FEE", insufficient: "NOT ENOUGH" };
const KIND: Record<string, string> = { attorney: "VA-accredited attorney", claims_agent: "VA-accredited claims agent", vso_rep: "VA-accredited VSO representative (never charges)" };
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function personView(v: Verification, snapshot: string) {
  const c = v.candidates[0];
  const where = (p: { city: string; state: string }) => [p.city, p.state].filter(Boolean).join(", ");
  switch (v.status) {
    case "verified_by_number":
      return { s: "ok", title: `${v.query}: verified`, body: `Accreditation number ${c.registration_num} belongs to ${c.first_name} ${c.last_name}, ${KIND[c.kind]}, ${where(c)}.` };
    case "exact_name_state":
      return { s: "ok", title: `${v.query}: name found in this state`, body: `${KIND[c.kind]} in ${where(c)}. Ask for their accreditation number (${c.registration_num}) to be sure it is the same person.`, list: v.candidates.length > 1 ? v.candidates : undefined };
    case "exact_name_only":
      return { s: "warn", title: `${v.query}: name found, not confirmed`, body: `${v.candidates.length} accredited ${v.candidates.length === 1 ? "person has" : "people have"} this name. Ask which state they work in and for their accreditation number.`, list: v.candidates };
    case "near_miss":
      return { s: "bad", title: `${v.query}: not in VA's roster`, body: `No exact match as of ${snapshot}. Similar names exist, but a similar name is not proof. Scammers sometimes borrow names that look like real ones.`, list: v.candidates, near: true };
    case "number_not_found":
      return { s: "bad", title: `${v.query}: number does not match`, body: "That accreditation number is not in VA's roster for this person." };
    case "not_found":
      return { s: "bad", title: `${v.query}: not in VA's roster`, body: `No accredited attorney, claims agent or VSO representative by this name as of ${snapshot}.` };
    default:
      return { s: "warn", title: "Nobody to check", body: "" };
  }
}

function Highlight({ text, quotes }: { text: string; quotes: string[] }) {
  // Mark only short quotes, so the highlight points at the words that mattered.
  const qs = quotes.filter((q) => q.length > 3 && q.length <= Math.max(90, text.length * 0.45) && text.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.length - a.length);
  if (!qs.length) return <>{text}</>;
  const re = new RegExp(`(${qs.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</>;
}

export default function Checker({ examples }: { examples: Example[] }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<CheckResult | null>(null);
  const [checked, setChecked] = useState("");
  const out = useRef<HTMLDivElement>(null);

  async function run(t = text) {
    if (!t.trim() && !name.trim() && !number.trim()) { setErr("Paste what they sent you, or enter their name or accreditation number."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, name, number, state }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `Check failed (${r.status})`);
      setRes(body); setChecked(t);
      requestAnimationFrame(() => out.current?.focus());
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  const reds = res?.flags.filter((f) => f.severity === "red") ?? [];
  const ambers = res?.flags.filter((f) => f.severity === "amber") ?? [];

  return (
    <>
      <form className="check" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label htmlFor="t">What did they send you?
          <span className="hint">Paste the ad, text message, email, web page or contract. Remove your own personal details first.</span>
        </label>
        <textarea id="t" value={text} onChange={(e) => setText(e.target.value)} maxLength={6000}
          placeholder="For example: “Get the rating you deserve. You only pay if you win: 5x your monthly increase.”" />
        <details className="more">
          <summary>Add their name or accreditation number</summary>
          <div className="row">
            <div><label htmlFor="n">Their name</label><input id="n" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
            <div><label htmlFor="num">Accreditation number</label><input id="num" type="text" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" /></div>
            <div><label htmlFor="st">Your state</label>
              <select id="st" value={state} onChange={(e) => setState(e.target.value)}><option value="">Choose</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
        </details>
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Check this helper"}</button>
          {err && <p className="error" role="alert">{err}</p>}
        </div>
        <div className="examples">
          <p>Or try a real example:</p>
          <ul>{examples.map((ex) => (
            <li key={ex.label}><button type="button" onClick={() => { setText(ex.text); run(ex.text); }}>{ex.label}</button></li>
          ))}</ul>
        </div>
      </form>

      {res && (
        <div className="result" ref={out} tabIndex={-1} aria-live="polite">
          <div className="stamp" data-v={res.verdict}>
            <div className="word">{WORD[res.verdict]}</div>
            <p className="headline">{res.headline}</p>
            <p className="meta">Checked against VA&apos;s accreditation roster of {prettyDate(res.roster.snapshot)} and the fee rules in 38 CFR 14.636.</p>
          </div>

          <ol className="checks">
            <li>
              <h3>Who is offering help?</h3>
              {res.recognizedOrgs.length > 0 && (
                <div className="person" data-s="ok">
                  <strong>{res.recognizedOrgs.join(", ")}: VA-recognized Veterans Service Organization</strong>
                  <p>Its accredited representatives help with claims for free. Make sure the person you deal with really works for it: ask for their name and accreditation number.</p>
                </div>
              )}
              {res.verifications.length === 0 && res.recognizedOrgs.length === 0 && (
                <p>No person or accreditation number to check. VA&apos;s roster lists people and Veterans Service Organizations, not companies. Ask for the name and accreditation number of the person who will work on your claim.</p>
              )}
              {res.verifications.map((v, i) => {
                const p = personView(v, prettyDate(res.roster.snapshot));
                return (
                  <div className="person" data-s={p.s} key={i}>
                    <strong>{p.title}</strong>
                    <p>{p.body}</p>
                    {p.list && (
                      <ul className="cands">{p.list.slice(0, 4).map((c) => (
                        <li key={c.registration_num}>{p.near ? "Similar: " : ""}{c.first_name} {c.last_name}, {KIND[c.kind].split(" (")[0]}, {c.city} {c.state}</li>
                      ))}</ul>
                    )}
                  </div>
                );
              })}
            </li>
            <li>
              <h3>Does the fee follow VA rules?</h3>
              {!res.flags.length && <p>{res.extraction.fee_requested === "no" ? "The text says this help is free." : "The text does not say what they charge. Before agreeing, ask how the fee is calculated and when you would pay it."}</p>}
              {[...reds, ...ambers].map((f) => (
                <div className="flag" data-s={f.severity} key={f.id}><p>{f.plain}</p><p className="cite">{f.cite}</p></div>
              ))}
              {checked && res.extraction.evidence.length > 0 && (
                <blockquote className="ev"><Highlight text={checked} quotes={res.extraction.evidence.map((e) => e.quote)} /></blockquote>
              )}
            </li>
            <li>
              <h3>Free help near you</h3>
              {res.freeHelp.orgs.length ? (
                <>
                  <p>Accredited Veterans Service Organizations help with VA claims for free. In {res.freeHelp.state}:</p>
                  <ul className="orgs">{res.freeHelp.orgs.slice(0, 5).map((o) => (
                    <li key={o.name}><strong>{o.name}</strong><span>{o.reps} accredited representatives{o.cities.length ? `, including in ${o.cities.join(", ")}` : ""}{o.phone ? `. Phone ${o.phone}` : ""}</span></li>
                  ))}</ul>
                </>
              ) : (
                <p>Accredited Veterans Service Organizations such as VFW, DAV and the American Legion help for free. Choose your state above to see who is near you, or use <a href="https://www.va.gov/get-help-from-accredited-representative/find-rep/">VA&apos;s find-a-representative tool</a>.</p>
              )}
              {res.verdict !== "green" && (
                <>
                  <h3>Two questions to ask them</h3>
                  <ol className="ask">
                    <li>What is your VA accreditation number?</li>
                    <li>Will you charge anything before VA decides my first claim, or based on my future monthly payments?</li>
                  </ol>
                </>
              )}
            </li>
          </ol>

          <details className="tech">
            <summary>How this was checked</summary>
            <p>Facts read by: {res.extractor.name}{res.extractor.model ? ` (${res.extractor.model})` : ""}. Roster: {res.roster.store}, {res.roster.ms} ms. The verdict comes from fixed rules, not from the AI.</p>
            {res.extractor.overrides?.length ? <p>Exact fee wording overrode the AI on: {res.extractor.overrides.join("; ")}.</p> : null}
            <pre>{JSON.stringify(res.extraction, null, 2)}</pre>
          </details>
        </div>
      )}
    </>
  );
}
