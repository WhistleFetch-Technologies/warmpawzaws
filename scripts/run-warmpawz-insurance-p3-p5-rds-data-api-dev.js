#!/usr/bin/env node
/**
 * Apply Warmpawz Insurance P3–P5 migrations on dev via RDS Data API.
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const FILES = [
  '1131_insurance_form_templates.sql',
  '1132_insurance_chat_cards_submissions.sql',
];

async function main() {
  for (const file of FILES) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', file), 'utf8');
    const stmts = splitPostgresStatements(sql);
    console.log(`\n${file} — ${stmts.length} statement(s)`);
    for (let i = 0; i < stmts.length; i++) {
      console.log(`--- ${file} ${i + 1} / ${stmts.length} ---`);
      await executeSQL(stmts[i], false);
    }
  }
  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('insurance_form_templates', 'insurance_form_template_versions', 'insurance_form_submissions')
     ORDER BY 1`,
  );
  console.log('\nTables:', tables);
  const column = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'chat_messages' AND column_name = 'metadata'`,
  );
  console.log('chat_messages.metadata:', column);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
