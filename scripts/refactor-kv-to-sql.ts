#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * ============================================================================
 * KV TO SQL REFACTORING HELPER SCRIPT
 * ============================================================================
 * 
 * This script helps identify and refactor KV usage to SQL repositories.
 * 
 * Usage:
 *   deno run --allow-read --allow-write scripts/refactor-kv-to-sql.ts [options]
 * 
 * Options:
 *   --scan          Scan for KV usage patterns
 *   --list          List files with KV usage
 *   --stats         Show statistics
 *   --refactor FILE Refactor a specific file
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { walk } from "jsr:@std/fs@1/walk";
import { readTextFile, writeTextFile } from "jsr:@std/fs@1";

const KV_PATTERNS = [
  /kv\.get\(/g,
  /kv\.set\(/g,
  /kv\.del\(/g,
  /kv\.getByPrefix\(/g,
  /kv\.list\(/g,
  /from ['"]\.\/kv_store/g,
  /from ['"]\.\.\/kv_store/g,
  /from ['"]\.\.\/\.\.\/kv_store/g,
  /import \* as kv from/g,
  /function \w+\([^)]*kv\s*:/g,
  /,\s*kv\s*:\s*any/g,
];

const REPOSITORY_MAPPINGS: Record<string, string> = {
  'customer:': 'getCustomersRepository()',
  'vendor:': 'getVendorsRepository()',
  'booking:': 'getBookingsRepository()',
  'payment:': 'getPaymentsRepository()',
  'order:': 'getOrdersRepository()',
  'service:': 'getServicesRepository()',
  'staff:': 'getStaffRepository()',
  'refund:': 'getRefundsRepository()',
  'payout:': 'getPayoutsRepository()',
  'notification:': 'getNotificationsRepository()',
};

interface FileStats {
  path: string;
  kvUsage: number;
  patterns: string[];
  needsRefactoring: boolean;
}

async function scanFile(filePath: string): Promise<FileStats | null> {
  try {
    const content = await readTextFile(filePath);
    const patterns: string[] = [];
    let kvUsage = 0;

    for (const pattern of KV_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        kvUsage += matches.length;
        patterns.push(pattern.source);
      }
    }

    if (kvUsage > 0) {
      return {
        path: filePath,
        kvUsage,
        patterns: [...new Set(patterns)],
        needsRefactoring: true,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
    return null;
  }
}

async function scanDirectory(dir: string): Promise<FileStats[]> {
  const results: FileStats[] = [];

  for await (const entry of walk(dir, {
    includeDirs: false,
    match: [/\.tsx?$/],
    skip: [/node_modules/, /\.git/, /dist/, /build/],
  })) {
    const stats = await scanFile(entry.path);
    if (stats) {
      results.push(stats);
    }
  }

  return results;
}

function generateReport(stats: FileStats[]): string {
  const totalFiles = stats.length;
  const totalKVUsage = stats.reduce((sum, s) => sum + s.kvUsage, 0);
  const byPattern = new Map<string, number>();

  stats.forEach(s => {
    s.patterns.forEach(p => {
      byPattern.set(p, (byPattern.get(p) || 0) + 1);
    });
  });

  let report = `# KV to SQL Refactoring Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total files with KV usage: ${totalFiles}\n`;
  report += `- Total KV operations: ${totalKVUsage}\n\n`;

  report += `## Files by KV Usage Count\n\n`;
  const sorted = [...stats].sort((a, b) => b.kvUsage - a.kvUsage);
  sorted.slice(0, 20).forEach(s => {
    report += `- \`${s.path}\`: ${s.kvUsage} KV operations\n`;
  });

  report += `\n## KV Patterns Found\n\n`;
  const sortedPatterns = [...byPattern.entries()].sort((a, b) => b[1] - a[1]);
  sortedPatterns.forEach(([pattern, count]) => {
    report += `- \`${pattern}\`: ${count} files\n`;
  });

  report += `\n## All Files Needing Refactoring\n\n`;
  stats.forEach(s => {
    report += `- [ ] \`${s.path}\` (${s.kvUsage} operations)\n`;
  });

  return report;
}

function suggestRefactoring(filePath: string, content: string): string {
  let refactored = content;

  // Remove kv parameter from function signatures
  refactored = refactored.replace(
    /export function (\w+)\(([^)]*),\s*kv\s*:\s*any\)/g,
    'export function $1($2)'
  );

  // Replace kv.get(`customer:${id}`) with repository calls
  refactored = refactored.replace(
    /await kv\.get\(`customer:(\$\{[^}]+\})`\)/g,
    'await getCustomersRepository().findById($1)'
  );

  refactored = refactored.replace(
    /await kv\.get\(`vendor:(\$\{[^}]+\})`\)/g,
    'await getVendorsRepository().findById($1)'
  );

  refactored = refactored.replace(
    /await kv\.get\(`booking:(\$\{[^}]+\})`\)/g,
    'await getBookingsRepository().findById($1)'
  );

  refactored = refactored.replace(
    /await kv\.get\(`payment:(\$\{[^}]+\})`\)/g,
    'await getPaymentsRepository().findById($1)'
  );

  refactored = refactored.replace(
    /await kv\.get\(`order:(\$\{[^}]+\})`\)/g,
    'await getOrdersRepository().findById($1)'
  );

  refactored = refactored.replace(
    /await kv\.get\(`service:(\$\{[^}]+\})`\)/g,
    'await getServicesRepository().findById($1)'
  );

  // Replace kv.set with repository create/update
  refactored = refactored.replace(
    /await kv\.set\(`customer:(\$\{[^}]+\})`,\s*([^)]+)\)/g,
    'await getCustomersRepository().upsert({ id: $1, ...$2 })'
  );

  // Add repository imports at the top
  if (refactored.includes('getCustomersRepository') && !refactored.includes('from "../../lib/repositories/customers.ts"')) {
    const importLine = `import { getCustomersRepository } from "../../lib/repositories/customers.ts";\n`;
    refactored = refactored.replace(/(import.*from.*['"]\.\/.*['"];?\n)/, `$1${importLine}`);
  }

  return refactored;
}

async function main() {
  const args = Deno.args;
  const command = args[0] || '--scan';

  if (command === '--scan' || command === '--list') {
    console.log('🔍 Scanning for KV usage...\n');
    const stats = await scanDirectory('supabase/functions');
    console.log(`Found ${stats.length} files with KV usage\n`);

    if (command === '--list') {
      stats.forEach(s => {
        console.log(`${s.path}: ${s.kvUsage} KV operations`);
      });
    }

    const report = generateReport(stats);
    await writeTextFile('docs/KV_REFACTORING_REPORT.md', report);
    console.log('✅ Report saved to docs/KV_REFACTORING_REPORT.md');
  } else if (command === '--stats') {
    const stats = await scanDirectory('supabase/functions');
    const total = stats.reduce((sum, s) => sum + s.kvUsage, 0);
    console.log(`Total files: ${stats.length}`);
    console.log(`Total KV operations: ${total}`);
    console.log(`Average per file: ${(total / stats.length).toFixed(2)}`);
  } else if (command === '--refactor' && args[1]) {
    const filePath = args[1];
    console.log(`🔄 Refactoring ${filePath}...\n`);
    
    const content = await readTextFile(filePath);
    const refactored = suggestRefactoring(filePath, content);
    
    const backupPath = `${filePath}.backup`;
    await writeTextFile(backupPath, content);
    await writeTextFile(filePath, refactored);
    
    console.log(`✅ Refactored ${filePath}`);
    console.log(`📦 Backup saved to ${backupPath}`);
    console.log('⚠️  Please review the changes before committing!');
  } else {
    console.log(`
Usage:
  deno run --allow-read --allow-write scripts/refactor-kv-to-sql.ts [command]

Commands:
  --scan          Scan for KV usage and generate report
  --list          List files with KV usage
  --stats         Show statistics
  --refactor FILE Refactor a specific file (creates backup)

Examples:
  deno run --allow-read --allow-write scripts/refactor-kv-to-sql.ts --scan
  deno run --allow-read --allow-write scripts/refactor-kv-to-sql.ts --refactor supabase/functions/make-server-3dd53475/booking-endpoints.tsx
    `);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

