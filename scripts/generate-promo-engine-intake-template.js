/**
 * Promo Engine intake — ONE sheet mirroring Admin Promotion Center → Engine wizard.
 * Dropdown labels/values match Basics / Audience / Benefits / Limits on dig.
 *
 * Usage: node scripts/generate-promo-engine-intake-template.js
 * Output: docs/promo-engine/Warmpawz_Promo_Engine_Promotions_Only.xlsx
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

const DEV_API = process.env.WPAY_DEV_API || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/** Same filter as apps/admin-web/lib/promo-engine/catalog-categories.ts */
function normalizeCatalogCategories(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const type = String(item.type || item.category_type || item.categoryType || '').toLowerCase();
    if (type === 'ecommerce' || type === 'product' || type === 'shop') continue;
    const status = String(item.status ?? item.is_active ?? item.isActive ?? '').toLowerCase();
    if (status === 'inactive' || status === 'false' || status === '0' || status === 'draft') continue;
    if (item.is_active === false) continue;
    const slug = String(item.slug || item.categoryId || item.category_id || item.id || '').trim();
    if (!slug || seen.has(slug)) continue;
    const name = String(item.name || item.display_name || item.displayName || slug).trim();
    seen.add(slug);
    out.push({ id: String(item.id || slug), slug, name });
  }
  return out;
}

async function loadDevCategories() {
  const body = await httpGetJson(`${DEV_API}/admin/catalog/categories`);
  return normalizeCatalogCategories(body.categories);
}

async function main() {
  const ExcelJS = require(path.join(
    __dirname,
    '..',
    'backend',
    'lambda',
    'node_modules',
    'exceljs',
  ));

  const categories = await loadDevCategories();
  console.log(`Loaded ${categories.length} dig catalogue categories for dropdowns`);

  const outDir = path.join(__dirname, '..', 'docs', 'promo-engine');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'Warmpawz_Promo_Engine_Promotions_Only.xlsx');

  // Exact UI strings from promotionEngine/steps/*.tsx
  const LIST = {
    YesNo: ['Yes', 'No'],
    Funding: ['Warmpawz', 'Vendor', 'Shared'], // BasicsStep display
    StackingPolicy: [
      // BasicsStep: policy.replace(/_/g, ' ')
      'NONE',
      'ORDER LEVEL',
      'SERVICE LEVEL',
      'CATEGORY LEVEL',
      'DISCOUNT WITH CASHBACK',
      'FULL STACKING',
    ],
    VisitSourceLetter: ['Vendor', 'Category', 'Platform'],
    PublishLetter: ['Vendor', 'Category', 'Platform'],
    Width: ['General (tele + appointment + Pay Bill)', 'Specific channels'],
    WhichVisit: [
      'Every visit',
      'This visit number',
      'Every Nth visit',
      'From visit N onward',
      'Between N and M',
    ],
    RankingOverride: [
      'Default — vendor beats category beats platform',
      'Least platform loss',
      'Max customer discount',
      'Max customer cashback',
      'Max customer total value',
    ],
    DiscountValueType: ['Percentage', 'Fixed ₹'],
    CashbackValueType: ['Fixed ₹', 'Percentage'],
    AddCashback: ['No', 'Yes'],
    RedeemScope: ['Same vendor', 'Same category', 'Anywhere'],
    CategoryName: categories.map((c) => c.name),
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Warmpawz Promo Engine';
  workbook.created = new Date();

  const lists = workbook.addWorksheet('_Lists', { state: 'hidden' });
  const listKeys = Object.keys(LIST);
  listKeys.forEach((key, colIdx) => {
    lists.getCell(1, colIdx + 1).value = key;
    (LIST[key] || []).forEach((val, i) => {
      lists.getCell(i + 2, colIdx + 1).value = val;
    });
  });
  function listRange(key) {
    const colIdx = listKeys.indexOf(key) + 1;
    const letter = lists.getColumn(colIdx).letter;
    const n = Math.max(1, (LIST[key] || []).length);
    return `_Lists!$${letter}$2:$${letter}$${n + 1}`;
  }

  const sheet = workbook.addWorksheet('Promotions', {
    properties: { tabColor: { argb: 'FFFF8C42' } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
  });

  /** Columns in wizard order — labels = builder Label / section text */
  const serviceCols = categories.map((c) => ({
    key: `svc_${c.slug}`,
    header: `Services · ${c.name}`,
    width: 14,
    list: 'YesNo',
    section: 'Basics',
    example: c.slug === 'grooming' ? 'Yes' : 'No',
  }));

  const columns = [
    // —— Basics ——
    { key: 'name', header: 'Promotion name', width: 28, section: 'Basics', example: 'Grooming Win Back' },
    { key: 'code', header: 'Code (optional)', width: 16, section: 'Basics', example: 'PROMO-GRM-001' },
    { key: 'priority', header: 'Priority (1–100)', width: 14, section: 'Basics', example: 50 },
    { key: 'startAt', header: 'Start', width: 18, section: 'Basics', example: '2026-10-01T00:00' },
    { key: 'endAt', header: 'End', width: 18, section: 'Basics', example: '2026-12-31T23:59' },
    { key: 'funding', header: 'Funding', width: 12, list: 'Funding', section: 'Basics', example: 'Warmpawz' },
    {
      key: 'stacking',
      header: 'Stacking policy',
      width: 22,
      list: 'StackingPolicy',
      section: 'Basics',
      example: 'SERVICE LEVEL',
    },
    { key: 'warmpawzPct', header: 'Warmpawz %', width: 12, section: 'Basics', example: '' },
    { key: 'vendorPct', header: 'Vendor %', width: 12, section: 'Basics', example: '' },
    {
      key: 'campaignId',
      header: 'Commercial campaign ID (optional)',
      width: 28,
      section: 'Basics',
      example: '',
    },
    ...serviceCols,
    // —— Audience · Visit source ——
    {
      key: 'visitLetter',
      header: 'Visit source',
      width: 12,
      list: 'VisitSourceLetter',
      section: 'Audience · Visit source',
      example: 'Platform',
    },
    {
      key: 'visitVendor',
      header: 'Vendor (Visit source)',
      width: 24,
      section: 'Audience · Visit source',
      example: '',
    },
    {
      key: 'visitCategory',
      header: 'Category (Visit source)',
      width: 22,
      list: 'CategoryName',
      section: 'Audience · Visit source',
      example: '',
    },
    {
      key: 'width',
      header: 'Width',
      width: 36,
      list: 'Width',
      section: 'Audience · Visit source',
      example: 'General (tele + appointment + Pay Bill)',
    },
    {
      key: 'visitChTele',
      header: 'Tele',
      width: 10,
      list: 'YesNo',
      section: 'Audience · Visit source',
      example: 'Yes',
    },
    {
      key: 'visitChAppt',
      header: 'Appointment',
      width: 12,
      list: 'YesNo',
      section: 'Audience · Visit source',
      example: 'Yes',
    },
    {
      key: 'visitChPaybill',
      header: 'Pay Bill',
      width: 10,
      list: 'YesNo',
      section: 'Audience · Visit source',
      example: 'Yes',
    },
    // —— Audience · Which visit ——
    {
      key: 'whichVisit',
      header: 'Which visit',
      width: 22,
      list: 'WhichVisit',
      section: 'Audience · Which visit',
      example: 'Every visit',
    },
    { key: 'visitN', header: 'N', width: 8, section: 'Audience · Which visit', example: '' },
    { key: 'visitM', header: 'M', width: 8, section: 'Audience · Which visit', example: '' },
    // —— Audience · Publish ——
    {
      key: 'publishLetter',
      header: 'Publish',
      width: 12,
      list: 'PublishLetter',
      section: 'Audience · Publish',
      example: 'Platform',
    },
    {
      key: 'publishVendor',
      header: 'Vendor (Publish)',
      width: 24,
      section: 'Audience · Publish',
      example: '',
    },
    {
      key: 'publishCategory',
      header: 'Category (Publish)',
      width: 22,
      list: 'CategoryName',
      section: 'Audience · Publish',
      example: '',
    },
    {
      key: 'ranking',
      header: 'Ranking override (optional)',
      width: 40,
      list: 'RankingOverride',
      section: 'Audience · Publish',
      example: 'Default — vendor beats category beats platform',
    },
    // —— Benefits · Discount ——
    {
      key: 'discountValueType',
      header: 'Discount · Value type',
      width: 16,
      list: 'DiscountValueType',
      section: 'Benefits · Discount',
      example: 'Percentage',
    },
    {
      key: 'discountValue',
      header: 'Discount · Value',
      width: 14,
      section: 'Benefits · Discount',
      example: 20,
    },
    {
      key: 'maxDiscount',
      header: 'Max discount ₹',
      width: 14,
      section: 'Benefits · Discount',
      example: '',
    },
    // —— Benefits · Cashback ——
    {
      key: 'addCashback',
      header: 'Cashback',
      width: 10,
      list: 'AddCashback',
      section: 'Benefits · Cashback',
      example: 'No',
    },
    {
      key: 'cashbackValueType',
      header: 'Cashback · Value type',
      width: 16,
      list: 'CashbackValueType',
      section: 'Benefits · Cashback',
      example: 'Fixed ₹',
    },
    {
      key: 'cashbackValue',
      header: 'Cashback · Value',
      width: 14,
      section: 'Benefits · Cashback',
      example: '',
    },
    {
      key: 'cashbackExpiry',
      header: 'Expires (days after earn)',
      width: 18,
      section: 'Benefits · Cashback',
      example: 30,
    },
    {
      key: 'redeemScope',
      header: 'Redeem cashback',
      width: 16,
      list: 'RedeemScope',
      section: 'Benefits · Cashback',
      example: 'Anywhere',
    },
    {
      key: 'redeemChTele',
      header: 'Redeem · tele',
      width: 12,
      list: 'YesNo',
      section: 'Benefits · Cashback',
      example: 'Yes',
    },
    {
      key: 'redeemChAppt',
      header: 'Redeem · appointment',
      width: 16,
      list: 'YesNo',
      section: 'Benefits · Cashback',
      example: 'Yes',
    },
    {
      key: 'redeemChPaybill',
      header: 'Redeem · Pay Bill',
      width: 14,
      list: 'YesNo',
      section: 'Benefits · Cashback',
      example: 'Yes',
    },
    {
      key: 'redeemChEcom',
      header: 'Redeem · ecommerce',
      width: 14,
      list: 'YesNo',
      section: 'Benefits · Cashback',
      example: 'Yes',
    },
    // —— Limits ——
    { key: 'perUser', header: 'Per user', width: 12, section: 'Limits · Usage limits', example: '' },
    {
      key: 'perTxn',
      header: 'Per transaction',
      width: 14,
      section: 'Limits · Usage limits',
      example: '',
    },
    {
      key: 'dailyLimit',
      header: 'Daily campaign limit',
      width: 16,
      section: 'Limits · Usage limits',
      example: '',
    },
    {
      key: 'campaignLimit',
      header: 'Campaign total uses',
      width: 16,
      section: 'Limits · Usage limits',
      example: '',
    },
    {
      key: 'budgetLimit',
      header: 'Budget limit ₹',
      width: 14,
      section: 'Limits · Usage limits',
      example: '',
    },
  ];

  // Section banner
  let i = 0;
  while (i < columns.length) {
    const section = columns[i].section;
    let j = i;
    while (j < columns.length && columns[j].section === section) j++;
    sheet.mergeCells(1, i + 1, 1, j);
    const cell = sheet.getCell(1, i + 1);
    cell.value = section;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8C42' } };
    i = j;
  }
  sheet.getRow(1).height = 22;

  const headerRow = sheet.getRow(2);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    sheet.getColumn(idx + 1).width = col.width;
  });
  headerRow.height = 40;

  const DATA_ROWS = 30;
  for (let r = 0; r < DATA_ROWS; r++) {
    const row = sheet.getRow(r + 3);
    columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = r === 0 ? (col.example ?? '') : '';
      if (col.list && LIST[col.list] && LIST[col.list].length) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [listRange(col.list)],
          showErrorMessage: true,
          errorTitle: 'Invalid',
          error: `Choose a value from the list (same as promo builder): ${col.header}`,
        };
      }
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      };
    });
  }
  sheet.getRow(3).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length },
  };

  // Category id map for engineering (hidden helper)
  const mapSheet = workbook.addWorksheet('_CategoryMap', { state: 'hidden' });
  mapSheet.getCell(1, 1).value = 'name';
  mapSheet.getCell(1, 2).value = 'slug';
  mapSheet.getCell(1, 3).value = 'id';
  categories.forEach((c, idx) => {
    mapSheet.getCell(idx + 2, 1).value = c.name;
    mapSheet.getCell(idx + 2, 2).value = c.slug;
    mapSheet.getCell(idx + 2, 3).value = c.id;
  });

  await workbook.xlsx.writeFile(outPath);

  // Best-effort overwrite of older multi-sheet template (skip if locked/open in Excel)
  const legacy = path.join(outDir, 'Warmpawz_Promo_Engine_Intake_Template.xlsx');
  try {
    fs.copyFileSync(outPath, legacy);
  } catch (err) {
    if (err && err.code === 'EBUSY') {
      console.warn(`Skipped overwrite of locked file: ${legacy}`);
    } else {
      throw err;
    }
  }

  console.log(`Wrote ${outPath}`);
  console.log(`Columns: ${columns.length} (builder-parity); categories: ${categories.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
