// Checks that the Snowflake store and the bundled snapshot give the same verification results.
import roster from "../data/roster.json";
import { SnapshotStore, verify } from "../lib/roster";
import { SnowflakeStore } from "../lib/snowflake";
const snap = new SnapshotStore(roster as never), sf = new SnowflakeStore();
const qs = [
  { number: "8877" }, { number: "999999" }, { first_name: "Jane", last_name: "Nobody", number: "8877" },
  { first_name: "Brian", last_name: "Hill", state: "FL" }, { first_name: "Brian", last_name: "Hill", state: "AK" },
  { first_name: "Carol", last_name: "Ponton" }, { first_name: "Robert", last_name: "Chisholm" }, { first_name: "Zachary", last_name: "Stolz" },
  { first_name: "Jennifer", last_name: "Steele" }, { first_name: "Fred", last_name: "Justo" }, { first_name: "Xqzt", last_name: "Vbnmw" },
];
let same = 0; const ms: number[] = [];
for (const q of qs) {
  const a = await verify(snap, q); const t = Date.now(); const b = await verify(sf, q); ms.push(Date.now() - t);
  const ok = a.status === b.status && a.candidates[0]?.registration_num === b.candidates[0]?.registration_num;
  same += ok ? 1 : 0;
  console.log(ok ? "same" : "DIFF", JSON.stringify(q), a.status, b.status, a.candidates[0]?.registration_num ?? "", b.candidates[0]?.registration_num ?? "");
}
const fa = await snap.freeHelp("FL"), fb = await sf.freeHelp("FL");
console.log("freeHelp FL top org:", fa[0]?.name, fa[0]?.reps, "|", fb[0]?.name, fb[0]?.reps);
console.log(`parity ${same}/${qs.length}; snowflake ms per verification: median ${ms.sort((x, y) => x - y)[Math.floor(ms.length / 2)]}, max ${ms.at(-1)}`);
