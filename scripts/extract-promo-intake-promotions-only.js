/**
 * Extract only the Promotions sheet (+ hidden _Lists for dropdowns)
 * from the full intake template.
 *
 * Usage: node scripts/extract-promo-intake-promotions-only.js
 */
const path = require('path');
const fs = require('fs');

async function main() {
  const ExcelJS = require(path.join(
    __dirname,
    '..',
    'backend',
    'lambda',
    'node_modules',
    'exceljs',
  ));

  const src = path.join(
    __dirname,
    '..',
    'docs',
    'promo-engine',
    'Warmpawz_Promo_Engine_Intake_Template.xlsx',
  );
  const out = path.join(
    __dirname,
    '..',
    'docs',
    'promo-engine',
    'Warmpawz_Promo_Engine_Promotions_Only.xlsx',
  );

  if (!fs.existsSync(src)) {
    throw new Error(`Source missing: ${src}`);
  }

  const wbIn = new ExcelJS.Workbook();
  await wbIn.xlsx.readFile(src);

  const wbOut = new ExcelJS.Workbook();
  wbOut.creator = 'Warmpawz Promo Engine';

  for (const name of ['_Lists', 'Promotions']) {
    const srcSheet = wbIn.getWorksheet(name);
    if (!srcSheet) throw new Error(`Missing sheet: ${name}`);

    const dest = wbOut.addWorksheet(name, {
      state: name === '_Lists' ? 'hidden' : 'visible',
      properties: srcSheet.properties,
      views: srcSheet.views,
    });

    srcSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const newRow = dest.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        if (cell.style) newCell.style = { ...cell.style };
        if (cell.dataValidation) newCell.dataValidation = { ...cell.dataValidation };
      });
      if (row.height) newRow.height = row.height;
    });

    srcSheet.columns.forEach((col, i) => {
      if (col && col.width) dest.getColumn(i + 1).width = col.width;
    });

    const merges = srcSheet.model && srcSheet.model.merges ? srcSheet.model.merges : [];
    merges.forEach((m) => dest.mergeCells(m));

    if (srcSheet.autoFilter) dest.autoFilter = srcSheet.autoFilter;
  }

  await wbOut.xlsx.writeFile(out);
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
