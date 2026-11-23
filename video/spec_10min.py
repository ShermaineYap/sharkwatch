"""Writes video/spec_10min.json (the 10-minute feature video): the 5-minute scenes plus deeper ones."""
import json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(root / "video/spec_5min.py")], check=True, capture_output=True)
base = {s["id"]: s for s in json.load(open(root / "video/spec_5min.json"))["segments"]}
held = json.load(open(root / "web/data/heldout-results.json"))["summary"]
dev = json.load(open(root / "web/data/study-results.json"))["summary"]
C = lambda n: str(root / f"video/cards/{n}.png")
S = lambda n: str(root / f"video/slides/s-{n}.png")
card = lambda i, n, text: dict(id=i, kind="slide", image=C(n), narration=text)

order = []
def add(seg): order.append(seg)

add(base["title"]); add(base["problem"])
add(card("who", "method", "") | dict(image=S(2), narration="Who is this for? A veteran, or a family member, who has just been pitched by a claims consultant on Facebook, by text, or by phone, and is about to sign. Many are older, on a phone, and under pressure. Some of these contracts end in bills of twelve thousand dollars or more, for help the V A says veterans can get free. So the product has one job: give a clear answer, with proof, before the signature, and point to free help."))
add(base["gap"])
add(card("data", "data", "On day one I downloaded the V A's own accreditation roster. The four Excel downloads turned out to be H T M L tables, so I parse them into clean files. There are five thousand two hundred attorneys, seven hundred claims agents, and eight thousand seven hundred V S O representatives, plus about eighteen thousand seven hundred links between representatives and eighty seven recognized organizations. One surprise shaped the whole product: there are no company names for attorneys or agents. Only people."))
add(base["home"]); add(base["expert"]); add(base["sixx"]); add(base["firm"]); add(base["vfw"]); add(base["inject"])
add(base["how"])
add(card("gemma", "gemma", "Gemma does the reading. In the live app that's Gemma four, thirty one B, through the Gemini A P I; in my study it's the small Gemma four E two B, running on a laptop class C P U. The prompt defines every choice, because the first version did not, and the small model filed five times your monthly increase under percent of back pay, hiding exactly the claim shark billing model. And the code does not trust the model. A name must really appear in the text. Every quote must be real. Anything off the schema becomes unknown."))
add(card("sql", "sql", "Snowflake holds the roster. One view joins attorneys, claims agents and V S O representatives into fourteen thousand six hundred and fifty four people, with a normalised name. The app queries it live through the Snowflake S Q L A P I, with key pair authentication. There are three tiers: an exact accreditation number, an exact name in a state, and Jaro Winkler suggestions, which are never treated as a match. The same tables give free help by state."))
add(base["fuzzy"])
add(card("rules", "rules", "Then fixed rules decide, not the A I. Each flag comes from thirty eight C F R fourteen point six three six and carries its paragraph. For example: a fee measured on future monthly payments, or any fee for a first claim, is red. Twenty percent of back pay from a verified attorney after a decision is only amber, with a reminder to get a written agreement. Red means the text itself shows a concrete breach. When the helper just can't be verified, the answer is amber: verify before you pay."))
add(card("tests", "tests", "These are the parts that must never break, so twenty unit tests cover them: the verification ladder, every rule, and the safety checks on the model's output, like a made up name never being verified, and a free consultation never counting as free help."))
add(card("method", "method", "For the study, I used real public text only: companies' own pricing pages, news reports quoting their contracts, law firms, veterans service organizations, and county offices. Company names are replaced. Labels were fixed by a written policy before any model ran. Then I made a public design freeze commit, collected nineteen new excerpts from different pages, and scored them once."))
add(base["results"] | dict(narration=base["results"]["narration"] + f" On the development set, which I looked at while improving the system, it got {dev['verdict_accuracy']['hybrid']} percent, with all {dev['red_recall']['n']} claim shark texts caught."))
add(card("postfix", "method", "") | dict(image=str(root / "video/cards/postfix.png"), narration="One honest note. After the freeze, the development set still showed the worst possible error: three unaccredited companies offering a free consultation came out as free help. I changed the design so a free consultation counts as a sales step, and the green result now says no fee, not free help. After that, no unaccredited text came out green in either set, and no held out verdict changed. That change is documented in the repository."))
add(base["limits"])
add(card("next", "next", "Next, I'd add state laws on claims consultants, Spanish, a daily roster refresh as a Snowflake task, and a one tap way to send a result to a service officer."))
add(base["close"])
json.dump({"segments": order}, open(root / "video/spec_10min.json", "w"), indent=1)
print(len(order), "segments;", sum(len(s["narration"].split()) for s in order), "words")
