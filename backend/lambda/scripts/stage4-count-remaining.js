/** Count remaining client-facing error.message patterns after Stage 4 batch. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(p, out);
    } else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(root);
const reCjson = /return c\.json\([^\n]*error\.message/g;
const reThis = /this\.error\(\s*error\.message/g;
let cjson = 0;
let thisErr = 0;
const byFile = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const a = (s.match(reCjson) || []).length;
  const b = (s.match(reThis) || []).length;
  if (a || b) {
    cjson += a;
    thisErr += b;
    byFile.push({ file: path.relative(root, f), a, b, t: a + b });
  }
}
byFile.sort((x, y) => y.t - x.t);
console.log('cjson_error_message', cjson);
console.log('this_error_message', thisErr);
console.log('files_with_hits', byFile.length);
console.log('TOP15');
byFile.slice(0, 15).forEach((r) => console.log(r.t, r.file));
