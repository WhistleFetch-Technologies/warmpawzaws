"""One-off: replace common hardcoded Rating stat literals in customer-web."""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "apps" / "customer-web"
dash = "\u2014"
patterns = [
    (re.compile(r"\{ value: '\*4\.\d', label: 'Rating' \}"), f"{{ value: '{dash}', label: 'Rating' }}"),
    (re.compile(r'\{ value: "\*4\.\d", label: "Rating" \}'), f'{{ value: "{dash}", label: "Rating" }}'),
    (re.compile(r"\{ value: '4\.\d', label: 'Rating', icon:"), f"{{ value: '{dash}', label: 'Rating', icon:"),
    (re.compile(r'\{ value: "4\.\d", label: "Rating", icon:'), f'{{ value: "{dash}", label: "Rating", icon:'),
    (re.compile(r"\{ value: '4\.\d', label: 'Stays', icon:"), f"{{ value: '{dash}', label: 'Stays', icon:"),
    (re.compile(r"\{ value: '4\.\d', label: 'Café', icon:"), f"{{ value: '{dash}', label: 'Café', icon:"),
]
count = 0
for p in root.rglob("*.tsx"):
    t = p.read_text(encoding="utf-8")
    nt = t
    for rx, rep in patterns:
        nt = rx.sub(rep, nt)
    if nt != t:
        p.write_text(nt, encoding="utf-8")
        count += 1
        print(p.relative_to(root))
print("files updated:", count)
