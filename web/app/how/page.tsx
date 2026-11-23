import fs from "node:fs";
import path from "node:path";

export const metadata = { title: "How SharkWatch works, and how well | SharkWatch" };

type Summary = {
  n: number;
  verdict_accuracy: Record<string, number>;
  field_accuracy: Record<string, Record<string, number | null>>;
  false_red_on_legit: Record<string, number>;
  red_recall: Record<string, number>;
  json_valid: string;
  gemma_latency_ms_cpu: { median: number; max: number };
  model: string;
};
type Row = { id: string; group: string; expected: string; gemma: string; baseline: string; hybrid: string };

function load(file: string): { summary: Summary; rows: Row[] } | null {
  const p = path.join(process.cwd(), "data", file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

const SYS = [["gemma", "Gemma alone"], ["baseline", "Keyword rules alone"], ["hybrid", "SharkWatch (Gemma + grounded fee patterns)"]] as const;

function Results({ title, note, d }: { title: string; note: string; d: { summary: Summary; rows: Row[] } }) {
  const s = d.summary;
  return (
    <>
      <h3>{title}</h3>
      <p>{note}</p>
      <div className="wrap">
        <table className="data">
          <thead><tr><th>System</th><th>Verdict correct</th><th>Claim-shark texts caught (red)</th><th>Legitimate texts wrongly marked red</th></tr></thead>
          <tbody>
            {SYS.map(([k, label]) => (
              <tr key={k}>
                <td>{label}</td>
                <td className="n">{s.verdict_accuracy[k]}% of {s.n}</td>
                <td className="n">{s.red_recall[k]} of {s.red_recall.n}</td>
                <td className="n">{s.false_red_on_legit[k]} of {s.false_red_on_legit.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Valid JSON from Gemma: {s.json_valid}. Gemma time per text on a 2-core CPU with no GPU: median {(s.gemma_latency_ms_cpu.median / 1000).toFixed(0)} s. Model: {s.model}.</p>
    </>
  );
}

export default function How() {
  const dev = load("study-results.json");
  const held = load("heldout-results.json");
  return (
    <>
      <h1>How SharkWatch works, and how well</h1>
      <p className="lede">Every number on this page comes from our own tests on real public text. The test files and scripts are in the public repository.</p>

      <h2>What happens when you press Check</h2>
      <ol>
        <li><strong>Gemma reads the text.</strong> It lists the people named, any accreditation number, how the fee is calculated, which stage of the claim this is, and whether they ask for your VA.gov login. It must quote the text for each fact. Names and quotes that are not really in the text are thrown away.</li>
        <li><strong>Exact fee wording wins.</strong> If the text literally says something like &ldquo;5 times your monthly increase&rdquo; or &ldquo;20% of past-due benefits&rdquo;, that wording overrides Gemma on the fee fields. It is a quote, not a judgement.</li>
        <li><strong>Every name is checked against VA&apos;s accreditation roster</strong> of 14,654 attorneys, claims agents and Veterans Service Organization representatives, stored in Snowflake.</li>
        <li><strong>Fixed rules decide.</strong> The verdict comes from the fee rules in 38 CFR 14.636, not from the AI. Every warning cites the paragraph it comes from.</li>
      </ol>

      <h2>Why a similar name is never called accredited</h2>
      <p>We tested name matching on the full roster. At a similarity setting that still finds 94% of real names with a typo, 12% of made-up names also &ldquo;match&rdquo; a real accredited person. For example, &ldquo;Jennifer Steele&rdquo; is not on the roster but scores 98.7 out of 100 against a real &ldquo;Jennifer Steel&rdquo;. So SharkWatch only says <em>verified</em> for an exact accreditation number, or an exact name in the same state. Similar names are shown as &ldquo;did you mean&rdquo;, never as a green light.</p>
      <div className="wrap">
        <table className="data">
          <thead><tr><th>Similarity threshold (0-100)</th><th>Real names with a typo found</th><th>Made-up names wrongly found</th></tr></thead>
          <tbody>
            {[[90, 100, 60.5], [94, 94, 12], [96, 86, 4], [98, 60, 1]].map(([t, a, b]) => (
              <tr key={t}><td className="n">{t}</td><td className="n">{a}%</td><td className="n">{b}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>200 typo&apos;d real names and 200 made-up names, roster snapshot of 23 November 2026. Accreditation numbers are unique across all 14,654 people; an exact name and state matched a random made-up name 0.09% of the time.</p>

      <h2>How well it reads real offers</h2>
      <p>We collected short excerpts from real public pages: unaccredited claims consultants&apos; own pricing pages and news reports quoting their contracts, accredited law firms, and free Veterans Service Organizations. Company names are replaced with [COMPANY]. Each excerpt was labelled under a written policy before any model saw it.</p>
      {dev && <Results d={dev} title="Development set" note="We looked at these results while improving the prompt and adding the grounded fee patterns, so they flatter the final system." />}
      {held && <Results d={held} title="Held-out set (scored once)" note="New excerpts from different pages, collected and labelled after the design was frozen. This is the honest number." />}
      {!dev && !held && <p>Study results are being generated.</p>}

      <h2>What we learned</h2>
      <p>The first version asked a small Gemma model to do everything. It often filed &ldquo;5x your monthly increase&rdquo; under &ldquo;percent of back pay&rdquo;, which hides exactly the billing model claim sharks use. Defining each choice in the prompt helped. Letting exact fee wording override the model helped more. Gemma still does what keyword rules cannot: reading names, roles, claim stage and indirect wording.</p>

      <h2>Limits</h2>
      <ul>
        <li>VA&apos;s roster lists people, not companies. A text that names only a company can&apos;t be verified, and SharkWatch says so.</li>
        <li>Someone can use a real accredited person&apos;s name. Ask for their accreditation number and check it.</li>
        <li>The study is small (tens of excerpts) and labelled by one person.</li>
        <li>The study ran Gemma 4 E2B on a CPU. The live app calls the larger Gemma 4 31B through the Gemini API when a key is set.</li>
        <li>Federal rules only. Some states have their own laws on claims consultants.</li>
        <li>General information, not legal advice. Nothing you paste is stored.</li>
      </ul>
    </>
  );
}
