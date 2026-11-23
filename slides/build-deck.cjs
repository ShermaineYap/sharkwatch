// Builds slides/SharkWatch.pptx from the study result files.
// Usage: node slides/build-deck.cjs <liveUrl> <skillDir>
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const [LIVE = "LIVE_URL", SKILL] = process.argv.slice(2);
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));

const root = path.join(__dirname, "..");
const dev = JSON.parse(fs.readFileSync(path.join(root, "web/data/study-results.json"), "utf8")).summary;
const held = JSON.parse(fs.readFileSync(path.join(root, "web/data/heldout-results.json"), "utf8")).summary;
const shots = path.join(root, "slides/shots");

const THEME = {
  name: "SharkWatch",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "1C2A3A", lt1: "FFFFFF", dk2: "2A3D52", lt2: "EEF1EC",
    accent1: "B3261E", accent2: "2F6B4F", accent3: "B7791F", accent4: "2F5D86", accent5: "9AA79C", accent6: "C9D1C8",
    hlink: "2F5D86", folHlink: "4A5A6A",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "SharkWatch: check a VA claims helper before you sign";
pres.author = "Shermaine Yap Shi Min";
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text1 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.5, w: 8.8, h: 1.4, fontSize: 40, bold: true, color: C.background1, align: "left", valign: "bottom", margin: 0 }, text: "" } },
            { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.05, w: 8.8, h: 1.6, fontSize: 18, color: C.background2, valign: "top", margin: 0 }, text: "" } }],
});
pres.defineSlideMaster({
  title: "LIGHT",
  background: { color: C.background2 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 8.8, h: 0.75, fontSize: 24, bold: true, color: C.text1, align: "left", valign: "top", margin: 0 }, text: "" } }],
  slideNumber: { x: 9.2, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: "4A5A6A" },
});

const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: C.text1, fontSize: 15, ...o });

// 1. Title
pres.addSection({ title: "Opening" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Opening" });
s.addText("SharkWatch", { placeholder: "title" });
s.addText("Check a VA claims helper before you sign.\nShermaine Yap Shi Min, solo. 305 Veterans Hackathon, November 2026. Technical track.", { placeholder: "body" });
s.addShape(pres.shapes.RECTANGLE, { x: 7.3, y: 0.5, w: 2.1, h: 0.9, fill: { color: C.text1 }, line: { color: C.accent1, width: 3 }, objectName: "stamp" });
T(s, "STOP", { x: 7.3, y: 0.5, w: 2.1, h: 0.9, fontSize: 32, bold: true, color: C.accent1, align: "center", valign: "middle", objectName: "stamp text" });
s.addNotes("I built SharkWatch, a tool that checks a VA claims helper before a veteran signs anything.");

// 2. Problem
pres.addSection({ title: "Problem" });
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Problem" });
s.addText("Filing a VA claim is free. Claim sharks charge anyway", { placeholder: "title" });
const stats = [
  ["$5,000+", "what unaccredited \"claim sharks\" usually charge for a claim that is free to file", "Kansas Legislative Research Dept., 2026"],
  ["5x-6x", "the typical fee: five or six times the veteran's monthly increase, from their own pricing pages", "Company pricing pages; KFF Health News"],
  ["$685M", "reported fraud losses by military consumers in 2025, up from $583M in 2024", "FTC data via AARP"],
];
stats.forEach(([big, lab, src], i) => {
  const x = 0.6 + i * 3.0;
  s.addShape(pres.shapes.RECTANGLE, { x, y: 1.45, w: 2.7, h: 3.2, fill: { color: C.background1 }, line: { color: HEX.accent6, width: 1 }, objectName: `stat card ${i + 1}` });
  T(s, big, { x: x + 0.2, y: 1.65, w: 2.3, h: 0.9, fontSize: 40, bold: true, color: i === 2 ? C.text1 : C.accent1 });
  T(s, lab, { x: x + 0.2, y: 2.6, w: 2.3, h: 1.3, fontSize: 14, valign: "top" });
  T(s, src, { x: x + 0.2, y: 4.05, w: 2.3, h: 0.45, fontSize: 10, color: "4A5A6A", valign: "bottom" });
});
T(s, "No federal criminal penalty applies today, so checking for yourself is the main protection.", { x: 0.6, y: 4.85, w: 8.4, h: 0.4, fontSize: 14, italic: true });
s.addNotes("Only VA-accredited attorneys and agents may charge, and never for a first claim. Bills to restore penalties have not become law.");

// 3. Gap
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Problem" });
s.addText("VA's search takes a name. Veterans get ads and contracts", { placeholder: "title" });
const gap = [
  ["Can't read an offer", "A veteran has an ad, a text or a contract, not a clean name to type in."],
  ["Lists people, not companies", "The VA roster names 14,654 attorneys, agents and VSO reps. No company names."],
  ["Silent on the fee", "It does not say whether \"5x your monthly increase\" or a fee for a first claim breaks the rules."],
  ["No next step", "It does not point a worried veteran to free, accredited help nearby."],
];
gap.forEach(([h, b], i) => {
  const x = 0.6 + (i % 2) * 4.45, y = 1.45 + Math.floor(i / 2) * 1.75;
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.2, h: 1.5, fill: { color: C.background1 }, line: { color: HEX.accent6, width: 1 }, objectName: `gap ${i + 1}` });
  s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.22, w: 0.42, h: 0.42, fill: { color: C.text1 }, line: { color: C.text1 }, objectName: `gap dot ${i + 1}` });
  T(s, "×", { x: x + 0.2, y: y + 0.22, w: 0.42, h: 0.42, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
  T(s, h, { x: x + 0.8, y: y + 0.2, w: 3.2, h: 0.45, fontSize: 16, bold: true });
  T(s, b, { x: x + 0.8, y: y + 0.65, w: 3.2, h: 0.75, fontSize: 14, valign: "top" });
});

// 4. How it works
pres.addSection({ title: "Solution" });
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Solution" });
s.addText("Paste the offer. Get a verdict with proof", { placeholder: "title" });
const steps = [
  ["Gemma reads", "Names, fee basis, claim stage, login requests, each with an exact quote. Invented names are dropped."],
  ["Exact wording wins", "\"5x your monthly increase\" or \"20% of back pay\" overrides the model on fee fields."],
  ["Snowflake checks", "Every name and number against VA's roster: exact lookups, Jaro-Winkler suggestions, free help by state."],
  ["Fixed rules decide", "38 CFR 14.636, with the paragraph cited on every warning. The AI never decides."],
];
steps.forEach(([h, b], i) => {
  const x = 0.6 + i * 2.25;
  s.addShape(pres.shapes.OVAL, { x, y: 1.5, w: 0.55, h: 0.55, fill: { color: C.text1 }, line: { color: C.text1 }, objectName: `step ${i + 1}` });
  T(s, String(i + 1), { x, y: 1.5, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
  if (i < 3) s.addShape(pres.shapes.LINE, { x: x + 0.65, y: 1.775, w: 1.5, h: 0, line: { color: HEX.accent5, width: 1.5, endArrowType: "triangle" }, objectName: `arrow ${i + 1}` });
  T(s, h, { x, y: 2.25, w: 2.05, h: 0.6, fontSize: 16, bold: true, valign: "top" });
  T(s, b, { x, y: 2.9, w: 2.05, h: 1.8, fontSize: 14, valign: "top" });
});
T(s, "Four verdicts: STOP for a concrete rule breach, CHECK to verify first, NO FEE when the text says the help is free, and NOT ENOUGH with two questions to ask.", { x: 0.6, y: 4.85, w: 8.8, h: 0.4, fontSize: 12, color: "4A5A6A" });

// 5. Headline finding
pres.addSection({ title: "Evidence" });
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Evidence" });
s.addText("A similar name is not proof, so it is never verified", { placeholder: "title" });
s.addChart(pres.charts.LINE, [
  { name: "Real names with a typo found", labels: ["90", "94", "96", "98"], values: [100, 94, 86, 60] },
  { name: "Made-up names wrongly found", labels: ["90", "94", "96", "98"], values: [60.5, 12, 4, 1] },
], {
  x: 0.5, y: 1.3, w: 5.4, h: 3.9, chartColors: [HEX.accent2, HEX.accent1], lineSize: 3, lineDataSymbolSize: 8,
  showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt",
  showValue: true, dataLabelPosition: "t", dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0\"%\"",
  catAxisTitle: "Jaro-Winkler threshold (Snowflake 0-100 scale)", showCatAxisTitle: true, catAxisTitleFontSize: 10, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt",
  valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt", valAxisLabelFormatCode: "0\"%\"",
  valGridLine: { color: HEX.accent6, size: 0.5 }, catGridLine: { style: "none" }, catAxisLabelColor: "4A5A6A", valAxisLabelColor: "4A5A6A",
  showTitle: true, title: "200 typo'd real names vs 200 made-up names", titleFontSize: 12, titleFontFace: "+mn-lt", objectName: "fuzzy match chart",
});
T(s, "\"Jennifer Steele\" is not on the roster but scores 98.7 against a real \"Jennifer Steel\".", { x: 6.2, y: 1.45, w: 3.3, h: 1.0, fontSize: 15, bold: true });
T(s, [
  { text: "Verified only by:", options: { bold: true, breakLine: true } },
  { text: "an exact accreditation number (unique across all 14,654 people), or", options: { bullet: true, breakLine: true } },
  { text: "an exact name in the same state (0.09% random collision).", options: { bullet: true, breakLine: true } },
  { text: "Similar names show as \"did you mean\", never green.", options: { breakLine: false } },
], { x: 6.2, y: 2.6, w: 3.3, h: 2.4, fontSize: 14, valign: "top", paraSpaceAfter: 4 });

// 6. Demo screens
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Evidence" });
s.addText("Built for a phone and a worried veteran", { placeholder: "title" });
[["phone_stop.png", "Fake \"claims expert\": STOP"], ["phone_check.png", "Accredited law firm: CHECK"], ["phone_free.png", "VFW page: NO FEE"]].forEach(([f, cap], i) => {
  const x = 0.9 + i * 2.95;
  if (fs.existsSync(path.join(shots, f))) s.addImage({ path: path.join(shots, f), x: x + 0.22, y: 1.2, w: 1.76, h: 3.48, altText: cap, objectName: `screen ${i + 1}` });
  T(s, cap, { x, y: 4.85, w: 2.2, h: 0.35, fontSize: 12, align: "center", color: "4A5A6A" });
});

// 7. Results
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Evidence" });
s.addText("Measured on real public text, held-out set scored once", { placeholder: "title" });
const pctTxt = (v) => `${v}%`;
const rows = [
  [{ text: "", options: { bold: true } }, { text: "Held-out: verdict correct", options: { bold: true } }, { text: "Held-out: sharks caught", options: { bold: true } }, { text: "Held-out: legit wrongly red", options: { bold: true } }, { text: "Dev: verdict correct", options: { bold: true } }],
  ...[["Gemma alone", "gemma"], ["Keyword rules alone", "baseline"], ["SharkWatch (hybrid)", "hybrid"]].map(([lab, k]) => [
    { text: lab, options: { bold: k === "hybrid" } },
    pctTxt(held.verdict_accuracy[k]), `${held.red_recall[k]} of ${held.red_recall.n}`, `${held.false_red_on_legit[k]} of ${held.false_red_on_legit.n}`, pctTxt(dev.verdict_accuracy[k]),
  ]),
];
s.addTable(rows, { x: 0.6, y: 1.35, w: 8.8, colW: [2.4, 1.7, 1.6, 1.6, 1.5], fontSize: 13, color: HEX.dk1, border: { type: "solid", pt: 0.75, color: HEX.accent6 }, fill: { color: "FFFFFF" }, rowH: 0.5, objectName: "results table" });
T(s, `Development set: ${dev.n} excerpts (seen while improving). Held-out: ${held.n} new excerpts from different pages, labelled under a written policy and scored once after a public design-freeze commit. Gemma 4 E2B on CPU: valid JSON ${held.json_valid}, median ${Math.round(held.gemma_latency_ms_cpu.median / 1000)} s per text. Small, single-annotator study.`, { x: 0.6, y: 3.6, w: 8.8, h: 1.2, fontSize: 13, color: "4A5A6A", valign: "top" });

// 8. Impact and limits
pres.addSection({ title: "Close" });
s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Close" });
s.addText("What it changes, and what it can't do yet", { placeholder: "title" });
T(s, [
  { text: "Impact", options: { bold: true, fontSize: 16, breakLine: true } },
  { text: "A veteran gets a verdict before signing, not after the bill.", options: { bullet: true, breakLine: true } },
  { text: "Every warning cites the regulation, so a VSO or family member can check it.", options: { bullet: true, breakLine: true } },
  { text: "Every result ends with free, accredited help in their state.", options: { bullet: true } },
], { x: 0.6, y: 1.4, w: 4.2, h: 3.4, fontSize: 14, valign: "top", paraSpaceAfter: 6 });
T(s, [
  { text: "Limits", options: { bold: true, fontSize: 16, breakLine: true } },
  { text: "The roster has people, not companies.", options: { bullet: true, breakLine: true } },
  { text: "A real name can be borrowed; the number is the strong check.", options: { bullet: true, breakLine: true } },
  { text: "Federal rules only; small single-annotator study.", options: { bullet: true, breakLine: true } },
  { text: "General information, not legal advice. Nothing pasted is stored.", options: { bullet: true } },
], { x: 5.2, y: 1.4, w: 4.2, h: 3.4, fontSize: 14, valign: "top", paraSpaceAfter: 6 });

// 9. Close
s = pres.addSlide({ masterName: "DARK", sectionTitle: "Close" });
s.addText("Try it before you sign", { placeholder: "title" });
s.addText(`${LIVE}\ngithub.com/ShermaineYap/sharkwatch (MIT)\nBuilt with Gemma, Snowflake, Next.js and VA's public roster. AI assistance: Claude (Anthropic), credited in the README.`, { placeholder: "body" });

(async () => {
  const out = path.join(root, "slides/SharkWatch.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
