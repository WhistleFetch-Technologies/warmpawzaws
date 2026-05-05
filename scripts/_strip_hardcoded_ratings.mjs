import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'apps', 'customer-web');
const dash = '\u2014';

const patterns = [
  [/\{ value: '\*4\.\d', label: 'Rating' \}/g, `{ value: '${dash}', label: 'Rating' }`],
  [/\{ value: '\*4\.\d', label: "Rating" \}/g, `{ value: '${dash}', label: "Rating" }`],
  [/\{ value: '4\.\d', label: 'Rating', icon:/g, `{ value: '${dash}', label: 'Rating', icon:`],
  [/\{ value: "4\.\d", label: "Rating", icon:/g, `{ value: "${dash}", label: "Rating", icon:`],
  [/\{ value: '4\.\d', label: 'Stays', icon:/g, `{ value: '${dash}', label: 'Stays', icon:`],
  [/\{ value: '4\.\d', label: 'Café', icon:/g, `{ value: '${dash}', label: 'Café', icon:`],
];

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const p of walk(root)) {
  let t = fs.readFileSync(p, 'utf8');
  let nt = t;
  for (const [rx, rep] of patterns) nt = nt.replace(rx, rep);
  if (nt !== t) {
    fs.writeFileSync(p, nt, 'utf8');
    console.log(path.relative(root, p));
    n++;
  }
}
console.log('files updated:', n);
