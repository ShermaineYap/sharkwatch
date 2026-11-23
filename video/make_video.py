"""Builds a 1920x1080 MP4 from a segment spec (JSON).

Segment kinds:
  phone: left = tall phone screenshot scrolled over time, right = HTML panel (title + points)
  slide: full-frame 1920x1080 image
Each segment gets Piper narration and burned-in captions (ASS).

Usage: python3 make_video.py spec.json out.mp4
"""
import json, os, re, subprocess, sys, wave, html, tempfile, pathlib
from playwright.sync_api import sync_playwright

VOICE = "/home/claude/voices/en_US-lessac-high.onnx"
W, H = 1920, 1080
PHONE_W = 600                    # displayed phone width
FRAME_TOP, FRAME_H = 50, 980      # displayed phone window
spec = json.load(open(sys.argv[1])); out = sys.argv[2]
work = pathlib.Path(tempfile.mkdtemp(prefix="vid_"))

def sh(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode: raise SystemExit(f"FAILED {' '.join(a[:6])}...\n{r.stderr[-1500:]}")
    return r.stdout

def tts(text, path):
    subprocess.run([sys.executable, "-m", "piper", "-m", VOICE, "-f", str(path), "--length-scale", "1.02", "--sentence-silence", "0.25"],
                   input=text, text=True, capture_output=True, check=True)
    with wave.open(str(path)) as w: return w.getnframes() / w.getframerate()

PANEL_CSS = """
body{margin:0;width:1180px;height:1080px;background:#EEF1EC;font-family:'Public Sans',Arial,sans-serif;color:#1C2A3A;display:flex;flex-direction:column;justify-content:center;padding:0 90px 0 70px;box-sizing:border-box}
.kick{font-size:30px;font-weight:700;color:#4A5A6A;margin-bottom:18px}
h1{font-size:62px;line-height:1.08;margin:0 0 34px;font-weight:800;letter-spacing:-.01em}
ul{margin:0;padding:0;list-style:none}
li{font-size:34px;line-height:1.35;margin:0 0 22px;padding-left:34px;position:relative}
li:before{content:'';position:absolute;left:0;top:.5em;width:14px;height:14px;background:var(--a,#1C2A3A);border-radius:50%}
.cite{font-size:24px;color:#2F5D86;margin-top:26px}
.stamp{display:inline-block;border:5px solid var(--a);outline:2px solid var(--a);outline-offset:6px;color:var(--a);font-weight:900;font-size:56px;padding:6px 22px;margin:0 0 30px 8px;letter-spacing:.02em}
"""
ACC = {"red": "#B3261E", "amber": "#B7791F", "green": "#2F6B4F", "ink": "#1C2A3A"}

def panel_png(p, path, page):
    a = ACC.get(p.get("accent", "ink"))
    parts = [f"<style>{PANEL_CSS}</style><body style='--a:{a}'>"]
    if p.get("kicker"): parts.append(f"<div class=kick>{html.escape(p['kicker'])}</div>")
    if p.get("stamp"): parts.append(f"<div><span class=stamp>{html.escape(p['stamp'])}</span></div>")
    parts.append(f"<h1>{html.escape(p['title'])}</h1><ul>")
    parts += [f"<li>{html.escape(b)}</li>" for b in p.get("points", [])]
    parts.append("</ul>")
    if p.get("cite"): parts.append(f"<div class=cite>{html.escape(p['cite'])}</div>")
    page.set_content("".join(parts) + "</body>"); page.wait_for_timeout(150)
    page.screenshot(path=str(path))

def ass_time(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def captions(text, dur, path, left_pad):
    # Split into short chunks; time them by character share.
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks = []
    for s in sents:
        words = s.split(); cur = []
        for w in words:
            cur.append(w)
            if len(" ".join(cur)) > 70: chunks.append(" ".join(cur)); cur = []
        if cur: chunks.append(" ".join(cur))
    total = sum(len(c) for c in chunks) or 1
    t = 0.0; lines = []
    for c in chunks:
        d = dur * len(c) / total
        lines.append(f"Dialogue: 0,{ass_time(t)},{ass_time(t + d)},Cap,,0,0,0,,{c}")
        t += d
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Public Sans,38,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB0203A2A,1,0,0,0,100,100,0,0,3,14,0,2,{left_pad},60,40,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    path.write_text(head + "\n".join(lines) + "\n")

segs = []
with sync_playwright() as pw:
    br = pw.chromium.launch(); page = br.new_page(viewport={"width": 1180, "height": 1080})
    for i, s in enumerate(spec["segments"]):
        wav = work / f"s{i}.wav"; dur = tts(s["narration"], wav) + 0.7
        vid = work / f"s{i}.mp4"; ass = work / f"s{i}.ass"
        if s["kind"] == "slide":
            captions(s["narration"], dur - 0.7, ass, 60)
            vf = f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x1C2A3A,subtitles={ass}"
            sh("ffmpeg", "-y", "-loop", "1", "-t", f"{dur:.2f}", "-i", s["image"], "-i", str(wav), "-vf", vf, "-r", "30",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", str(vid))
        else:
            pnl = work / f"p{i}.png"; panel_png(s["panel"], pnl, page)
            captions(s["narration"], dur - 0.7, ass, 760)
            shot = s["shot"]
            iw, ih = map(int, sh("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", shot).strip().split(","))
            scale = PHONE_W / iw; win = int(FRAME_H / scale)
            y0, y1 = [min(max(0, int(v)), max(0, ih - win)) for v in s.get("scroll", [0, 0])]
            ts, te = s.get("scroll_at", [dur * 0.25, dur * 0.75])
            ease = f"({y0}+({y1}-{y0})*(1-cos(PI*min(max((t-{ts})/{te - ts:.3f},0),1)))/2)"
            fc = (f"color=c=0x1C2A3A:s={W}x{H}:d={dur:.2f}[bg];"
                  f"[0:v]crop={iw}:{win}:0:'{ease}',scale={PHONE_W}:{FRAME_H}[ph];"
                  f"[1:v]scale=1180:1080[pn];"
                  f"[bg][ph]overlay=80:{FRAME_TOP}[a];[a][pn]overlay=740:0,subtitles={ass}[v]")
            sh("ffmpeg", "-y", "-loop", "1", "-t", f"{dur:.2f}", "-i", shot, "-loop", "1", "-t", f"{dur:.2f}", "-i", str(pnl), "-i", str(wav),
               "-filter_complex", fc, "-map", "[v]", "-map", "2:a", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
               "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-t", f"{dur:.2f}", str(vid))
        segs.append(vid); print(f"segment {i} {s.get('id','')} {dur:.1f}s", flush=True)
    br.close()

lst = work / "list.txt"; lst.write_text("".join(f"file '{p}'\n" for p in segs))
sh("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", out)
print("total", sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out).strip(), "s ->", out)
