/**
 * ============================================================================
 * AUTOMATED KV TO SQL MIGRATION SCRIPT
 * ============================================================================
 * 
 * This script helps automate the migration of KV operations to SQL.
 * It scans endpoint files and suggests SQL replacements.
 * 
 * Usage: deno run scripts/automated-kv-to-sql-migration.ts
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { walk } from "jsr:@std/fs/walk";

interface MigrationPattern {
  kvPattern: RegExp;
  sqlReplacement: string;
  description: string;
}

const MIGRATION_PATTERNS: MigrationPattern[] = [
  {
    kvPattern: /await\s+kv\.get\(`payment:(\w+)`\)/g,
    sqlReplacement: 'await paymentsRepo.findById($1)',
    description: 'Payment lookup'
  },
  {
    kvPattern: /await\s+kv\.set\(`payment:(\w+)`,\s*(\w+)\)/g,
    sqlReplacement: 'await paymentsRepo.update($1, $2)',
    description: 'Payment update'
  },
  {
    kvPattern: /await\s+kv\.get\(`booking:(\w+)`\)/g,
    sqlReplacement: 'await bookingsRepo.findById($1)',
    description: 'Booking lookup'
  },
  {
    kvPattern: /await\s+kv\.get\(`vendor:(\w+)`\)/g,
    sqlReplacement: 'await vendorsRepo.findById($1)',
    description: 'Vendor lookup'
  },
  {
    kvPattern: /await\s+kv\.get\(`customer:phone:(\w+)`\)/g,
    sqlReplacement: 'await customersRepo.findByPhone($1)',
    description: 'Customer lookup by phone'
  },
  {
    kvPattern: /await\s+kv\.get\(`customer:(\w+)`\)/g,
    sqlReplacement: 'await customersRepo.findById($1)',
    description: 'Customer lookup'
  },
  {
    kvPattern: /await\s+kv\.get\(`service:(\w+)`\)/g,
    sqlReplacement: 'await servicesRepo.findById($1)',
    description: 'Service lookup'
  },
  {
    kvPattern: /await\s+kv\.get\(`payout:(\w+)`\)/g,
    sqlReplacement: 'await payoutsRepo.findById($1)',
    description: 'Payout lookup'
  },
];

async function scanFile(filePath: string): Promise<{
  file: string;
  patterns: { pattern: string; count: number }[];
  totalKV: number;
}> {
  const content = await Deno.readTextFile(filePath);
  const patterns: { pattern: string; count: number }[] = [];
  let totalKV = 0;

  for (const migrationPattern of MIGRATION_PATTERNS) {
    const matches = content.match(migrationPattern.kvPattern);
    if (matches && matches.length > 0) {
      patterns.push({
        pattern: migrationPattern.description,
        count: matches.length
      });
      totalKV += matches.length;
    }
  }

  // Count all KV operations
  const allKV = (content.match(/kv\.(get|set|del|getByPrefix)/g) || []).length;
  totalKV = allKV;

  return { file: filePath, patterns, totalKV };
}

async function main() {
  console.log("🔍 Scanning for KV operations...\n");

  const endpointFiles: string[] = [];
  for await (const entry of walk("src/supabase/functions/server", {
    match: [/\.tsx?$/],
  })) {
    if (entry.isFile) {
      endpointFiles.push(entry.path);
    }
  }

  const results = await Promise.all(
    endpointFiles.map(file => scanFile(file))
  );

  const filesWithKV = results.filter(r => r.totalKV > 0);
  const totalKVOps = results.reduce((sum, r) => sum + r.totalKV, 0);

  console.log(`📊 Found ${totalKVOps} KV operations across ${filesWithKV.length} files\n`);

  console.log("📋 Top 20 files with KV usage:\n");
  filesWithKV
    .sort((a, b) => b.totalKV - a.totalKV)
    .slice(0, 20)
    .forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.file.split('/').pop()}`);
      console.log(`   KV operations: ${result.totalKV}`);
      if (result.patterns.length > 0) {
        console.log(`   Patterns: ${result.patterns.map(p => `${p.pattern} (${p.count})`).join(', ')}`);
      }
      console.log("");
    });

  console.log(`\n✅ Migration suggestions:`);
  console.log(`   - Use kv-to-sql-adapter.ts for gradual migration`);
  console.log(`   - Create SQL-based versions of critical endpoints`);
  console.log(`   - Systematically replace KV operations`);
}

if (import.meta.main) {
  main().catch(console.error);
}

