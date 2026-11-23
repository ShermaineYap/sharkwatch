import fs from "node:fs";
import path from "node:path";
import Checker, { type Example } from "@/components/Checker";

function examples(): Example[] {
  const items = fs.readFileSync(path.join(process.cwd(), "data/examples.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return items;
}

export default function Home() {
  return (
    <>
      <h1>Check a VA claims helper before you sign</h1>
      <p className="lede">Filing a VA claim is free, yet some companies charge veterans thousands of dollars to do it. Paste what a helper sent you. We check VA&apos;s list of accredited people and the federal fee rules, then point you to free help.</p>
      <Checker examples={examples()} />
    </>
  );
}
