#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env

/**
 * SQL-Only Compliance Test
 * 
 * Verifies that no KV store operations remain in critical backend files
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";

interface TestResult {
  file: string;
  passed: boolean;
  errors: string[];
  kvOperations: number;
}

const CRITICAL_DIRS = [
  'supabase/functions/make-server-3dd53475',
  'supabase/lib/repositories',
];

const FORBIDDEN_PATTERNS = [
  /kv\.get\s*\(/g,
  /kv\.set\s*\(/g,
  /kv\.del\s*\(/g,
  /kv\.getByPrefix\s*\(/g,
  /from\s+['"]\.\/kv_store/g,
  /from\s+['"]\.\.\/kv_store/g,
  /import\s+\*\s+as\s+kv\s+from/g,
  /import\s+.*kv_store/g,
];

const ALLOWED_FILES = [
  'kv_store.tsx', // The KV store implementation itself
  'kv-safe.tsx', // Safe wrapper (if still needed temporarily)
  '.kv-backup', // Backup files
  '.backup', // Backup files
];

async function testFile(filePath: string): Promise<TestResult> {
  const result: TestResult = {
    file: filePath,
    passed: true,
    errors: [],
    kvOperations: 0,
  };

  // Skip allowed files
  if (ALLOWED_FILES.some(allowed => filePath.includes(allowed))) {
    return result;
  }

  try {
    const content = await Deno.readTextFile(filePath);
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        result.passed = false;
        result.kvOperations += matches.length;
        result.errors.push(
          `Found ${matches.length} KV operation(s): ${pattern.toString()}`
        );
      }
    }
  } catch (error) {
    result.passed = false;
    result.errors.push(`Error reading file: ${error.message}`);
  }

  return result;
}

async function runTests(): Promise<void> {
  console.log('🧪 Starting SQL-Only Compliance Tests...\n');

  const results: TestResult[] = [];
  let totalFiles = 0;
  let totalKVOperations = 0;

  for (const dir of CRITICAL_DIRS) {
    try {
      for await (const entry of walk(dir, {
        includeFiles: true,
        includeDirs: false,
        match: [/\.tsx?$/],
      })) {
        totalFiles++;
        const result = await testFile(entry.path);
        if (!result.passed) {
          results.push(result);
          totalKVOperations += result.kvOperations;
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${dir}:`, error);
    }
  }

  // Print results
  console.log(`\n📊 Test Results:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files with KV operations: ${results.length}`);
  console.log(`   Total KV operations found: ${totalKVOperations}\n`);

  if (results.length === 0) {
    console.log('✅ ALL TESTS PASSED - Zero KV operations found!\n');
    Deno.exit(0);
  } else {
    console.log('❌ TESTS FAILED - KV operations found in the following files:\n');
    
    // Group by directory
    const byDir = new Map<string, TestResult[]>();
    for (const result of results) {
      const dir = result.file.split('/').slice(0, -1).join('/');
      if (!byDir.has(dir)) {
        byDir.set(dir, []);
      }
      byDir.get(dir)!.push(result);
    }

    // Print grouped results
    for (const [dir, dirResults] of byDir.entries()) {
      console.log(`\n📁 ${dir} (${dirResults.length} files):`);
      for (const result of dirResults.slice(0, 10)) { // Show first 10
        console.log(`   ❌ ${result.file.split('/').pop()}`);
        console.log(`      KV Operations: ${result.kvOperations}`);
        if (result.errors.length > 0) {
          console.log(`      Errors: ${result.errors[0]}`);
        }
      }
      if (dirResults.length > 10) {
        console.log(`   ... and ${dirResults.length - 10} more files`);
      }
    }

    console.log(`\n❌ FAILED: ${results.length} files still contain KV operations`);
    console.log(`   Total KV operations to migrate: ${totalKVOperations}\n`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await runTests();
}

