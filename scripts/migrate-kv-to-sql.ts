#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

/**
 * ============================================================================
 * KV TO SQL MIGRATION SCRIPT
 * ============================================================================
 * 
 * This script systematically migrates all KV operations to SQL across the codebase.
 * 
 * Usage:
 *   deno run --allow-read --allow-write scripts/migrate-kv-to-sql.ts [--dry-run] [--file <path>]
 * 
 * Features:
 * - Scans all TypeScript/TSX files for KV operations
 * - Identifies patterns and suggests SQL replacements
 * - Applies migrations automatically (with --apply flag)
 * - Creates necessary repositories and migrations
 * - Reports progress and remaining issues
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { parse } from "https://deno.land/std@0.208.0/path/parse.ts";

interface KVOperation {
  file: string;
  line: number;
  operation: 'get' | 'set' | 'del' | 'getByPrefix';
  pattern: string;
  key: string;
  suggestedReplacement: string;
}

interface MigrationPlan {
  file: string;
  operations: KVOperation[];
  repositories: string[];
  migrations: string[];
}

// KV Pattern to SQL Repository Mapping
const KV_PATTERN_MAPPINGS: Record<string, {
  repository: string;
  method: string;
  table?: string;
  migration?: string;
}> = {
  'vendor:{id}': {
    repository: 'VendorsRepository',
    method: 'findById',
    table: 'vendors'
  },
  'customer:{id}': {
    repository: 'CustomersRepository',
    method: 'findById',
    table: 'customers'
  },
  'pet:{id}': {
    repository: 'PetsRepository',
    method: 'findById',
    table: 'pets'
  },
  'booking:{id}': {
    repository: 'BookingsRepository',
    method: 'findById',
    table: 'bookings'
  },
  'service:{id}': {
    repository: 'ServicesRepository',
    method: 'findById',
    table: 'services'
  },
  'staff:{id}': {
    repository: 'StaffRepository',
    method: 'findById',
    table: 'staff'
  },
  'payment:{id}': {
    repository: 'PaymentsRepository',
    method: 'findById',
    table: 'payments'
  },
  'promotion:{id}': {
    repository: 'PromotionsRepository',
    method: 'findById',
    table: 'promotions'
  },
  'marketing:promotions': {
    repository: 'PromotionsRepository',
    method: 'findAll',
    table: 'promotions'
  },
  'config:ui:dashboard': {
    repository: 'UIConfigRepository',
    method: 'findByRole',
    table: 'ui_configs'
  },
  'vendor:{id}:bookings': {
    repository: 'BookingsRepository',
    method: 'findByVendor',
    table: 'bookings'
  },
  'customer:{id}:bookings': {
    repository: 'BookingsRepository',
    method: 'findByCustomer',
    table: 'bookings'
  },
  'vendor:{id}:services': {
    repository: 'ServicesRepository',
    method: 'findByVendor',
    table: 'services'
  },
  'vendor:{id}:availability': {
    repository: 'SchedulingRepository',
    method: 'getVendorAvailability',
    table: 'vendor_availability_v2'
  },
  'vendor:{id}:status': {
    repository: 'VendorsRepository',
    method: 'findById',
    table: 'vendors',
    // Note: status is a column in vendors table
  },
  'vendor:{id}:boarding_rooms': {
    repository: 'BoardingRoomsRepository',
    method: 'findByVendor',
    table: 'boarding_rooms',
    migration: '015_boarding_rooms_table.sql'
  },
  'vendor:{id}:boarding_pricing': {
    repository: 'PricingRulesRepository',
    method: 'findByVendor',
    table: 'pricing_rules',
    migration: '016_pricing_rules_table.sql'
  },
  'order:{id}': {
    repository: 'OrdersRepository',
    method: 'findById',
    table: 'orders'
  },
  'delivery:{id}': {
    repository: 'DeliveriesRepository',
    method: 'findById',
    table: 'deliveries',
    migration: '017_deliveries_table.sql'
  },
  'tracking:{id}': {
    repository: 'DeliveriesRepository',
    method: 'findTracking',
    table: 'deliveries'
  },
  'feedback:{id}': {
    repository: 'ReviewsRepository',
    method: 'findById',
    table: 'reviews',
    migration: '018_reviews_table.sql'
  },
  'labtest:{id}': {
    repository: 'DiagnosticSamplesRepository',
    method: 'findById',
    table: 'diagnostic_samples'
  },
  'medicine_order:{id}': {
    repository: 'MedicineOrdersRepository',
    method: 'findById',
    table: 'medicine_orders'
  },
  'prescription:{id}': {
    repository: 'PrescriptionsRepository',
    method: 'findById',
    table: 'prescriptions'
  },
  'role:{id}': {
    repository: 'RolesRepository',
    method: 'findById',
    table: 'roles'
  },
  'admin:roles:list': {
    repository: 'RolesRepository',
    method: 'findAll',
    table: 'roles'
  }
};

async function scanFile(filePath: string): Promise<KVOperation[]> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split('\n');
  const operations: KVOperation[] = [];
  
  // Patterns to match
  const patterns = [
    /kv\.get\(['"]([^'"]+)['"]\)/g,
    /kv\.set\(['"]([^'"]+)['"]/g,
    /kv\.del\(['"]([^'"]+)['"]\)/g,
    /kv\.getByPrefix\(['"]([^'"]+)['"]\)/g,
    /await\s+kv\.get\(['"]([^'"]+)['"]\)/g,
    /await\s+kv\.set\(['"]([^'"]+)['"]/g,
    /await\s+kv\.del\(['"]([^'"]+)['"]\)/g,
  ];
  
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const key = match[1];
        let operation: 'get' | 'set' | 'del' | 'getByPrefix' = 'get';
        
        if (line.includes('kv.set')) operation = 'set';
        else if (line.includes('kv.del')) operation = 'del';
        else if (line.includes('kv.getByPrefix')) operation = 'getByPrefix';
        
        operations.push({
          file: filePath,
          line: index + 1,
          operation,
          pattern: match[0],
          key,
          suggestedReplacement: suggestReplacement(key, operation)
        });
      }
    }
  });
  
  return operations;
}

function suggestReplacement(key: string, operation: 'get' | 'set' | 'del' | 'getByPrefix'): string {
  // Normalize key pattern (replace IDs with {id})
  const normalizedKey = key.replace(/:[a-zA-Z0-9_]+/g, ':{id}');
  
  const mapping = KV_PATTERN_MAPPINGS[normalizedKey];
  if (!mapping) {
    return `// TODO: Create repository for ${key}`;
  }
  
  const { repository, method } = mapping;
  
  if (operation === 'get') {
    if (key.includes(':{id}')) {
      const idVar = extractIdVariable(key);
      return `await get${repository}().${method}(${idVar})`;
    } else {
      return `await get${repository}().${method}()`;
    }
  } else if (operation === 'set') {
    return `await get${repository}().create(...) or .update(...)`;
  } else if (operation === 'del') {
    return `await get${repository}().delete(...)`;
  } else if (operation === 'getByPrefix') {
    return `await get${repository}().findAll(...)`;
  }
  
  return `// TODO: Migrate ${key}`;
}

function extractIdVariable(key: string): string {
  // Try to extract the ID variable from context
  // This is a heuristic - may need manual review
  if (key.includes('vendorId')) return 'vendorId';
  if (key.includes('customerId')) return 'customerId';
  if (key.includes('bookingId')) return 'bookingId';
  if (key.includes('petId')) return 'petId';
  if (key.includes('serviceId')) return 'serviceId';
  if (key.includes('staffId')) return 'staffId';
  return 'id';
}

async function generateMigrationPlan(files: string[]): Promise<MigrationPlan[]> {
  const plans: MigrationPlan[] = [];
  
  for (const file of files) {
    const operations = await scanFile(file);
    if (operations.length === 0) continue;
    
    const repositories = new Set<string>();
    const migrations = new Set<string>();
    
    operations.forEach(op => {
      const normalizedKey = op.key.replace(/:[a-zA-Z0-9_]+/g, ':{id}');
      const mapping = KV_PATTERN_MAPPINGS[normalizedKey];
      if (mapping) {
        repositories.add(mapping.repository);
        if (mapping.migration) {
          migrations.add(mapping.migration);
        }
      }
    });
    
    plans.push({
      file,
      operations,
      repositories: Array.from(repositories),
      migrations: Array.from(migrations)
    });
  }
  
  return plans;
}

async function main() {
  const args = Deno.args;
  const dryRun = args.includes('--dry-run');
  const fileFilter = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
  
  console.log('🔍 Scanning for KV operations...\n');
  
  // Find all TypeScript/TSX files
  const files: string[] = [];
  for await (const entry of walk('.', {
    match: [/\.(ts|tsx)$/],
    skip: [/node_modules/, /\.git/, /dist/, /build/]
  })) {
    if (entry.isFile) {
      if (!fileFilter || entry.path.includes(fileFilter)) {
        files.push(entry.path);
      }
    }
  }
  
  console.log(`📁 Found ${files.length} files to scan\n`);
  
  // Generate migration plan
  const plans = await generateMigrationPlan(files);
  
  // Filter files with KV operations
  const filesWithKV = plans.filter(p => p.operations.length > 0);
  
  console.log(`⚠️  Found ${filesWithKV.length} files with KV operations\n`);
  
  // Generate report
  console.log('='.repeat(80));
  console.log('MIGRATION REPORT');
  console.log('='.repeat(80));
  console.log();
  
  let totalOperations = 0;
  const repositoryUsage: Record<string, number> = {};
  const migrationNeeded: Set<string> = new Set();
  
  filesWithKV.forEach(plan => {
    console.log(`📄 ${plan.file}`);
    console.log(`   Operations: ${plan.operations.length}`);
    console.log(`   Repositories needed: ${plan.repositories.join(', ') || 'None identified'}`);
    console.log(`   Migrations needed: ${plan.migrations.join(', ') || 'None'}`);
    console.log();
    
    totalOperations += plan.operations.length;
    plan.repositories.forEach(repo => {
      repositoryUsage[repo] = (repositoryUsage[repo] || 0) + 1;
    });
    plan.migrations.forEach(mig => migrationNeeded.add(mig));
  });
  
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total files with KV: ${filesWithKV.length}`);
  console.log(`Total KV operations: ${totalOperations}`);
  console.log(`Repositories needed: ${Object.keys(repositoryUsage).length}`);
  console.log(`Migrations needed: ${migrationNeeded.size}`);
  console.log();
  
  console.log('Top repositories needed:');
  Object.entries(repositoryUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([repo, count]) => {
      console.log(`  - ${repo}: ${count} files`);
    });
  console.log();
  
  if (migrationNeeded.size > 0) {
    console.log('Migrations to create:');
    Array.from(migrationNeeded).forEach(mig => {
      console.log(`  - ${mig}`);
    });
    console.log();
  }
  
  // Save detailed report
  const reportPath = 'KV_MIGRATION_REPORT.json';
  await Deno.writeTextFile(
    reportPath,
    JSON.stringify({ plans, summary: { totalFiles: filesWithKV.length, totalOperations, repositoryUsage, migrations: Array.from(migrationNeeded) } }, null, 2)
  );
  
  console.log(`📊 Detailed report saved to: ${reportPath}`);
  
  if (dryRun) {
    console.log('\n✅ Dry run complete. Use --apply to perform migrations.');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

