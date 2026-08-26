/**
 * One-off: Furrybae catalog → upload-ready Warmpawz NPI sheet.
 * Groups size rows into products, keeps each row's Image folder URL.
 */
const ExcelJS = require('exceljs');
const path = require('path');

const INPUT =
  process.argv[2] ||
  'C:/Users/Ketan Hirani/Downloads/Copy of Furrybae-product_upload.xlsx';
const OUTPUT =
  process.argv[3] ||
  'C:/Users/Ketan Hirani/Downloads/Furrybae-product_upload_ready.xlsx';

const SIZE_ORDER = ['XS', 'SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL', 'XXXL'];
const SIZE_ALIASES = {
  xs: 'XS',
  s: 'Small',
  small: 'Small',
  m: 'Medium',
  medium: 'Medium',
  l: 'Large',
  large: 'Large',
  xl: 'XL',
  xxl: 'XXL',
  xxxl: 'XXXL',
};

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.hyperlink && /^https?:\/\//i.test(String(v.hyperlink))) {
      return String(v.hyperlink).trim();
    }
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if (v.text && typeof v.text === 'object' && Array.isArray(v.text.richText)) {
      return v.text.richText.map((t) => t.text).join('').trim();
    }
    if (typeof v.text === 'string') return v.text.trim();
    if (v.result != null) return String(v.result).trim();
  }
  return String(v).trim();
}

function extractSize(specs, title) {
  const specM = String(specs).match(/size\s*:\s*([A-Za-z0-9]+)/i);
  if (specM) {
    const key = specM[1].toLowerCase();
    return SIZE_ALIASES[key] || specM[1];
  }
  const titleM = String(title).match(/\b(XXXL|XXL|XL|XS|Small|Medium|Large)\s*$/i);
  if (titleM) {
    const key = titleM[1].toLowerCase();
    return SIZE_ALIASES[key] || titleM[1];
  }
  return '';
}

function parentTitle(rawTitle) {
  let t = String(rawTitle).trim();
  const pipe = t.indexOf('|');
  if (pipe > 0) t = t.slice(0, pipe).trim();
  t = t.replace(/\s+(XXXL|XXL|XL|XS|Small|Medium|Large)\s*$/i, '').trim();
  t = t.replace(/\s+Bathrobe Grey\s+/i, ' Grey Bathrobe ');
  t = t.replace(/\s+/g, ' ').trim();
  const robe = t.match(
    /^(Furrybae Premium Bamboo Cotton Dog (?:Grey|Blue) Bathrobe)/i,
  );
  if (robe) return robe[1];
  return t;
}

function groupIdFromTitle(title) {
  return `FB-${String(title)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}`;
}

function hsnForTitle(title) {
  const s = title.toLowerCase();
  if (s.includes('bathrobe')) return '63026090';
  if (s.includes('hoodie')) return '61103000';
  return '61091000';
}

function formatTax(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '0%';
  if (s.includes('%')) return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? `${n}%` : '0%';
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(INPUT);
  const ws = wb.getWorksheet('NPI') || wb.worksheets[0];

  const headers = [];
  ws.getRow(2).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = cellText(cell);
  });

  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn < 3) return;
    const bag = { _rn: rn, _imageCell: row.getCell(13).value };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (headers[col]) bag[headers[col]] = cellText(cell);
    });
    if (!String(bag['Title*'] || '').trim()) return;
    rows.push(bag);
  });

  const prepared = rows.map((r) => {
    const title = parentTitle(r['Title*']);
    const size = extractSize(r['Product Specifications'], r['Title*']);
    const skuCode = String(r['HSN*'] || '').trim();
    return {
      ...r,
      title,
      size,
      skuCode,
      groupId: groupIdFromTitle(title),
      hsn: hsnForTitle(title),
    };
  });

  const groups = new Map();
  for (const r of prepared) {
    if (!groups.has(r.groupId)) groups.set(r.groupId, []);
    groups.get(r.groupId).push(r);
  }

  const lastRow = ws.rowCount;
  for (let r = 3; r <= lastRow; r++) {
    ws.getRow(r).values = [];
  }

  let excelRow = 3;
  const summary = [];
  for (const [gid, members] of groups) {
    members.sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a.size.toUpperCase());
      const ib = SIZE_ORDER.indexOf(b.size.toUpperCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    summary.push({
      groupId: gid,
      title: members[0].title,
      sizes: members.map((m) => m.size).join(','),
      count: members.length,
    });
    for (const m of members) {
      const row = ws.getRow(excelRow);
      const values = [
        m.title,
        String(m.Description || '').trim(),
        String(m['Key Features'] || '').trim(),
        String(m['Brand*'] || 'FurryBae').trim() || 'FurryBae',
        String(m['Category*'] || 'Pet Clothing').trim() || 'Pet Clothing',
        String(m['Product Specifications'] || '').trim(),
        m['Weight (kg)'] || '',
        m['Product Length (cm)'] || '',
        m['Product Breadth (cm)'] || '',
        m['Product Height (cm)'] || '',
        m.skuCode,
        m['Quantity*'] || '50',
        String(m['Image (1000X1000px)*'] || '').trim(),
        m['Price*'] || '',
        m['Pet Type'] || 'Dog',
        formatTax(m['Tax*']),
        m.hsn,
        String(m['Manufacturing Details'] || '').trim() || 'Country of Origin: India',
        String(m['Delivery Regions'] || '').trim(),
        m.groupId,
        m.size ? 'Size' : '',
        m.size,
        '',
        '',
        '',
        '',
        'Third party',
      ];
      values.forEach((val, idx) => {
        if (val !== '' && val != null) row.getCell(idx + 1).value = val;
      });
      const img = String(m['Image (1000X1000px)*'] || '').trim();
      if (/^https?:\/\//i.test(img)) {
        row.getCell(13).value = { text: img, hyperlink: img };
      }
      excelRow++;
    }
  }

  await wb.xlsx.writeFile(OUTPUT);
  console.log('Wrote', OUTPUT);
  console.log('Products:', groups.size, 'rows:', prepared.length);
  for (const s of summary) {
    console.log(`  ${s.groupId} | ${s.count} sizes (${s.sizes}) | ${s.title}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
