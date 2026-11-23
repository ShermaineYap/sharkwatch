import sys, re, pandas as pd, io, datetime
raw, out = sys.argv[1], sys.argv[2]
names = {"attorneyexcellist":"attorneys","caexcellist":"claims_agents","repexcellist":"vso_reps","orgsexcellist":"vso_org_reps"}
snap = datetime.date.today().isoformat()
for src, dst in names.items():
    html = open(f"{raw}/{src}.out", encoding="latin-1").read()
    df = pd.read_html(io.StringIO(html), header=0, flavor="lxml")[0].astype(str)
    df = df.apply(lambda c: c.str.strip().str.lstrip("'").replace({"nan": ""}))
    df.columns = [re.sub(r"\W+","_",c.strip().lower()).strip("_") for c in df.columns]
    df["snapshot_date"] = snap
    df.to_csv(f"{out}/{dst}.csv", index=False)
    print(f"{dst}: {len(df):,} rows; cols={list(df.columns)}")
    print("   blanks:", {c:int((df[c]=='').sum()) for c in df.columns if (df[c]=='').sum()})
