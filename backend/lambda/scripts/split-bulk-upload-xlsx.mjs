/**
 * Split bulk product upload XLSX into smaller uploadable batches.
 * Usage: node scripts/split-bulk-upload-xlsx.mjs <input.xlsx> [outputDir] [rowsPerFile]
 */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const inputPath = process.argv[2];
const outputDir =
  process.argv[3] ||
  path.join(path.dirname(inputPath || '.'), 'seller_warmpawz_upload_batches');
const rowsPerFile = Math.max(1, parseInt(process.argv[4] || '15', 10));
const keepFirstImageOnly = process.argv[5] !== '--all-images';

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: node split-bulk-upload-xlsx.mjs <input.xlsx> [outputDir] [rowsPerFile]');
  process.exit(1);
}

const SHEET_NAME = 'NPI';
const VARIANT_GUIDE = 'Variant Guide';
const IMAGE_COL = 13; // Image (1000X1000px)*

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object' && v !== null) {
    if ('result' in v && v.result != null) return cellText({ value: v.result });
    if ('text' in v) return String(v.text).trim();
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join('').trim();
    }
    if ('hyperlink' in v) return String(v.text ?? v.hyperlink ?? '').trim();
  }
  return String(v).trim();
}

function firstImageOnly(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const first = s
    .split(/[,\n]/)
    .map((u) => u.trim())
    .find(Boolean);
  return first ?? '';
}

async function copySheetStructure(sourceWs, targetWs) {
  targetWs.properties = { ...sourceWs.properties };
  targetWs.columns = sourceWs.columns?.map((c) => ({ ...c })) ?? [];

  sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetWs.getRow(rowNumber);
    targetRow.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      if (cell.style) targetCell.style = JSON.parse(JSON.stringify(cell.style));
      if (cell.fill) targetCell.fill = JSON.parse(JSON.stringify(cell.fill));
      if (cell.font) targetCell.font = JSON.parse(JSON.stringify(cell.font));
      if (cell.alignment) targetCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      if (cell.border) targetCell.border = JSON.parse(JSON.stringify(cell.border));
      if (cell.note) targetCell.note = cell.note;
    });
    targetRow.commit();
  });

  // Copy merges from row 1-2 header area
  for (const merge of sourceWs.model?.merges ?? []) {
    if (/^A1:/.test(merge) || /^[A-Z]+1:/.test(merge) || /^[A-Z]+2:/.test(merge)) {
      try {
        targetWs.mergeCells(merge);
      } catch {
        /* ignore duplicate merge */
      }
    }
  }
}

async function copyVariantGuide(sourceWb, targetWb) {
  const guide = sourceWb.getWorksheet(VARIANT_GUIDE);
  if (!guide) return;
  const targetGuide = targetWb.addWorksheet(VARIANT_GUIDE);
  guide.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetGuide.getRow(rowNumber);
    targetRow.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      if (cell.style) targetCell.style = JSON.parse(JSON.stringify(cell.style));
      if (cell.font) targetCell.font = JSON.parse(JSON.stringify(cell.font));
      if (cell.fill) targetCell.fill = JSON.parse(JSON.stringify(cell.fill));
      if (cell.alignment) targetCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      if (cell.border) targetCell.border = JSON.parse(JSON.stringify(cell.border));
    });
    targetRow.commit();
  });
  guide.columns?.forEach((col, i) => {
    if (col?.width) targetGuide.getColumn(i + 1).width = col.width;
  });
}

const sourceWb = new ExcelJS.Workbook();
await sourceWb.xlsx.load(fs.readFileSync(inputPath));
const sourceWs = sourceWb.getWorksheet(SHEET_NAME) || sourceWb.worksheets[0];
if (!sourceWs) {
  console.error('No worksheet found');
  process.exit(1);
}

const dataRows = [];
sourceWs.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  if (rowNumber < 3) return;
  const title = cellText(row.getCell(1));
  if (!title) return;
  dataRows.push(rowNumber);
});

if (dataRows.length === 0) {
  console.error('No product rows found');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const batchCount = Math.ceil(dataRows.length / rowsPerFile);
const written = [];

for (let b = 0; b < batchCount; b++) {
  const batchRowNums = dataRows.slice(b * rowsPerFile, (b + 1) * rowsPerFile);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);

  // Copy header rows 1-2 from source
  for (let r = 1; r <= 2; r++) {
    const srcRow = sourceWs.getRow(r);
    const dstRow = ws.getRow(r);
    dstRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const dstCell = dstRow.getCell(col);
      dstCell.value = cell.value;
      if (cell.style) dstCell.style = JSON.parse(JSON.stringify(cell.style));
      if (cell.fill) dstCell.fill = JSON.parse(JSON.stringify(cell.fill));
      if (cell.font) dstCell.font = JSON.parse(JSON.stringify(cell.font));
      if (cell.alignment) dstCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      if (cell.border) dstCell.border = JSON.parse(JSON.stringify(cell.border));
      if (cell.note) dstCell.note = cell.note;
    });
    dstRow.commit();
  }

  // Copy merges on header rows
  for (const merge of sourceWs.model?.merges ?? []) {
    const m = String(merge);
    if (m.endsWith('1') || m.includes('1:') || m.includes('2:')) {
      try {
        ws.mergeCells(merge);
      } catch {
        /* ignore */
      }
    }
  }

  // Copy column widths
  sourceWs.columns?.forEach((col, i) => {
    if (col?.width) ws.getColumn(i + 1).width = col.width;
  });

  // Write product rows starting at row 3
  let outRow = 3;
  for (const srcRowNum of batchRowNums) {
    const srcRow = sourceWs.getRow(srcRowNum);
    const dstRow = ws.getRow(outRow);
    dstRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const dstCell = dstRow.getCell(col);
      if (col === IMAGE_COL && keepFirstImageOnly) {
        dstCell.value = firstImageOnly(cellText(cell));
      } else {
        dstCell.value = cell.value;
      }
      if (cell.style) dstCell.style = JSON.parse(JSON.stringify(cell.style));
      if (cell.font) dstCell.font = JSON.parse(JSON.stringify(cell.font));
      if (cell.fill) dstCell.fill = JSON.parse(JSON.stringify(cell.fill));
      if (cell.alignment) dstCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      if (cell.border) dstCell.border = JSON.parse(JSON.stringify(cell.border));
    });
    dstRow.commit();
    outRow++;
  }

  await copyVariantGuide(sourceWb, wb);

  const num = String(b + 1).padStart(2, '0');
  const total = String(batchCount).padStart(2, '0');
  const fileName = `seller_warmpawz_upload_batch_${num}_of_${total}.xlsx`;
  const outPath = path.join(outputDir, fileName);
  const buf = await wb.xlsx.writeBuffer();
  fs.writeFileSync(outPath, Buffer.from(buf));
  written.push({ fileName, outPath, rows: batchRowNums.length });
  console.log(`Wrote ${fileName} (${batchRowNums.length} products)`);
}

const readme = `# Warmpawz bulk upload batches

Source: ${path.basename(inputPath)}
Total products: ${dataRows.length}
Batches: ${batchCount} files × up to ${rowsPerFile} products each
Images: ${keepFirstImageOnly ? 'first image URL only per product (faster upload)' : 'all images kept'}

## Upload order
Upload batch_01 first, wait for success, then batch_02, and so on.

## Files
${written.map((w) => `- ${w.fileName} — ${w.rows} products`).join('\n')}
`;

fs.writeFileSync(path.join(outputDir, 'README.txt'), readme);
console.log(`\nDone. ${batchCount} files in:\n${outputDir}`);
console.log(readme);
