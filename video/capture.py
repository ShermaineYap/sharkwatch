"""Tall phone screenshots (390 CSS px wide, 2x) of each demo scene, for the videos and slides."""
import sys
from playwright.sync_api import sync_playwright
base, out = sys.argv[1], sys.argv[2]
scenes = [
    ("home", None, None, None),
    ("stop_expert", "claims expert", None, None),
    ("stop_6x", "6x", None, None),
    ("check_firm", "Law firm", None, None),
    ("check_firm_fl", "Law firm", None, "FL"),
    ("free_vfw_fl", "VFW", None, "FL"),
    ("injection", "AI instruction", None, None),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, ex, person, state in scenes:
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.goto(base); pg.wait_for_load_state("networkidle")
        if state:
            pg.get_by_text("Add their name or accreditation number").click()
            pg.select_option("#st", state)
        if ex:
            pg.locator(".examples button", has_text=ex).first.click()
            pg.wait_for_selector(".stamp", timeout=20000); pg.wait_for_timeout(700)
            pg.evaluate("document.querySelectorAll('details.tech').forEach(d=>d.open=false)")
        pg.screenshot(path=f"{out}/{name}.png", full_page=True)
        # where the stamp sits, so the video can scroll to it
        y = pg.evaluate("(()=>{const s=document.querySelector('.stamp');return s? s.getBoundingClientRect().top+scrollY:0})()")
        print(name, int(y * 2))
        pg.close()
    b.close()
