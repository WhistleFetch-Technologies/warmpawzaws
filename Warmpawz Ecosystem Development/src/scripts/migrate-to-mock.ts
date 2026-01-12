/**
 * BATCH MIGRATION SCRIPT
 * Converts Supabase/Backend calls to MockAPI across all customer components
 * 
 * Usage: node scripts/migrate-to-mock.ts [component-path]
 * Example: node scripts/migrate-to-mock.ts components/customer/AppointmentsList.tsx
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// MIGRATION PATTERNS
// ============================================================================

interface MigrationPattern {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  description: string;
}

const PATTERNS: MigrationPattern[] = [
  // 1. Remove Supabase imports
  {
    name: 'remove-supabase-imports',
    pattern: /import\s+{\s*projectId,?\s*publicAnonKey\s*}\s+from\s+['"].*supabase\/info['"]\s*;?\n?/g,
    replacement: '',
    description: 'Remove Supabase info imports'
  },
  
  // 2. Add MockAPI import (if not exists)
  {
    name: 'add-mockapi-import',
    pattern: /(import.*from\s+['"]react['"];?\n)/,
    replacement: "$1import MockAPI from '../../lib/mockAPI';\nimport { toast } from 'sonner@2.0.3';\n",
    description: 'Add MockAPI and toast imports'
  },
  
  // 3. Remove API_BASE constant
  {
    name: 'remove-api-base',
    pattern: /const\s+API_BASE\s*=\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475`\s*;?\n?/g,
    replacement: '',
    description: 'Remove API_BASE constant'
  },
  
  // 4. Remove BASE_URL constant
  {
    name: 'remove-base-url',
    pattern: /const\s+BASE_URL\s*=\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475`\s*;?\n?/g,
    replacement: '',
    description: 'Remove BASE_URL constant'
  },
];

// ============================================================================
// ENDPOINT TO MOCKAPI MAPPING
// ============================================================================

interface EndpointMapping {
  pattern: RegExp;
  mockApiCall: (match: string, ...groups: string[]) => string;
  description: string;
}

const ENDPOINT_MAPPINGS: EndpointMapping[] = [
  // Customer - Get Bookings
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/customer\/bookings\/\$\{([^}]+)\}`[^)]*\)/g,
    mockApiCall: (match, phone) => `await MockAPI.customer.getBookings(${phone})`,
    description: 'Get customer bookings'
  },
  
  // Customer - Get Pets
  {
    pattern: /await\s+fetch\(\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475\/customer\/pets\/\$\{([^}]+)\}`[^)]*\)/g,
    mockApiCall: (match, phone) => `await MockAPI.customer.getPets(${phone})`,
    description: 'Get customer pets'
  },
  
  // Booking - Get Details
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/bookings\/\$\{([^}]+)\}`[^)]*\)/g,
    mockApiCall: (match, bookingId) => `await MockAPI.booking.getBooking(${bookingId})`,
    description: 'Get booking details'
  },
  
  // Booking - Cancel
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/bookings\/\$\{([^}]+)\}\/cancel`[^)]*method:\s*['"]POST['"][^)]*\)/g,
    mockApiCall: (match, bookingId) => `await MockAPI.booking.cancelBooking(${bookingId})`,
    description: 'Cancel booking'
  },
  
  // Vendor - Search/Discover
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/customer\/discover-services\?[^`]*`[^)]*\)/g,
    mockApiCall: () => `await MockAPI.search.searchVendors({ /* Add filters */ })`,
    description: 'Search vendors'
  },
  
  // Products - Get All
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/products`[^)]*\)/g,
    mockApiCall: () => `MockAPI.ecommerce.getProducts()`,
    description: 'Get all products'
  },
  
  // Orders - Create
  {
    pattern: /await\s+fetch\(\s*`\$\{API_BASE\}\/orders`[^)]*method:\s*['"]POST['"][^)]*\)/g,
    mockApiCall: () => `await MockAPI.ecommerce.createOrder({ /* Add order data */ })`,
    description: 'Create order'
  },
  
  // AI Chat
  {
    pattern: /await\s+fetch\(\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475\/ai\/chat`[^)]*\)/g,
    mockApiCall: () => `await MockAPI.ai.chat({ /* Add message */ })`,
    description: 'AI Chat'
  },
];

// ============================================================================
// RESPONSE HANDLING PATTERNS
// ============================================================================

const RESPONSE_PATTERNS: MigrationPattern[] = [
  // Replace response.ok checks with try/catch
  {
    name: 'simplify-response-handling',
    pattern: /if\s*\(\s*response\.ok\s*\)\s*\{[\s\S]*?const\s+data\s*=\s*await\s+response\.json\(\)\s*;([\s\S]*?)\}\s*else\s*\{[\s\S]*?toast\.error\([^)]+\);?\s*\}/g,
    replacement: (match, successCode) => {
      return `// MockAPI handles errors internally${successCode}`;
    },
    description: 'Simplify response handling (MockAPI returns data directly)'
  },
  
  // Remove Authorization headers
  {
    name: 'remove-auth-headers',
    pattern: /headers:\s*\{\s*['"]Authorization['"]\s*:\s*`Bearer\s+\$\{publicAnonKey\}`\s*\}/g,
    replacement: '// No auth headers needed for MockAPI',
    description: 'Remove Authorization headers'
  },
];

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

class ComponentMigrator {
  private filePath: string;
  private originalContent: string;
  private migratedContent: string;
  private changes: string[] = [];
  
  constructor(filePath: string) {
    this.filePath = filePath;
    this.originalContent = fs.readFileSync(filePath, 'utf-8');
    this.migratedContent = this.originalContent;
  }
  
  migrate(): boolean {
    console.log(`\n📝 Migrating: ${this.filePath}`);
    console.log('='.repeat(80));
    
    // Check if file needs migration
    if (!this.needsMigration()) {
      console.log('✅ Already migrated or no Supabase references found');
      return false;
    }
    
    // Apply all pattern migrations
    this.applyPatterns();
    
    // Apply endpoint mappings
    this.applyEndpointMappings();
    
    // Apply response handling simplifications
    this.applyResponsePatterns();
    
    // Clean up extra blank lines
    this.cleanup();
    
    return true;
  }
  
  private needsMigration(): boolean {
    return (
      this.originalContent.includes('supabase.co/functions/v1/make-server') ||
      this.originalContent.includes('projectId, publicAnonKey') ||
      this.originalContent.includes('API_BASE') ||
      this.originalContent.includes('BASE_URL')
    );
  }
  
  private applyPatterns(): void {
    for (const pattern of PATTERNS) {
      const before = this.migratedContent;
      this.migratedContent = this.migratedContent.replace(
        pattern.pattern,
        pattern.replacement as string
      );
      
      if (before !== this.migratedContent) {
        this.changes.push(`✓ ${pattern.description}`);
      }
    }
  }
  
  private applyEndpointMappings(): void {
    for (const mapping of ENDPOINT_MAPPINGS) {
      const matches = this.migratedContent.match(mapping.pattern);
      if (matches) {
        this.migratedContent = this.migratedContent.replace(
          mapping.pattern,
          mapping.mockApiCall as any
        );
        this.changes.push(`✓ ${mapping.description}`);
      }
    }
  }
  
  private applyResponsePatterns(): void {
    for (const pattern of RESPONSE_PATTERNS) {
      const before = this.migratedContent;
      this.migratedContent = this.migratedContent.replace(
        pattern.pattern,
        pattern.replacement as string
      );
      
      if (before !== this.migratedContent) {
        this.changes.push(`✓ ${pattern.description}`);
      }
    }
  }
  
  private cleanup(): void {
    // Remove multiple consecutive blank lines
    this.migratedContent = this.migratedContent.replace(/\n{3,}/g, '\n\n');
    
    // Ensure MockAPI import exists
    if (!this.migratedContent.includes("import MockAPI from")) {
      const reactImport = this.migratedContent.match(/import.*from\s+['"]react['"]/);
      if (reactImport) {
        this.migratedContent = this.migratedContent.replace(
          reactImport[0],
          `${reactImport[0]}\nimport MockAPI from '../../lib/mockAPI';`
        );
        this.changes.push('✓ Added MockAPI import');
      }
    }
  }
  
  save(dryRun: boolean = false): void {
    if (this.changes.length === 0) {
      console.log('ℹ️  No changes needed');
      return;
    }
    
    console.log('\n📋 Changes applied:');
    this.changes.forEach(change => console.log(`   ${change}`));
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN - File not saved');
      console.log('\n📄 Preview of migrated content:');
      console.log('-'.repeat(80));
      console.log(this.migratedContent.substring(0, 500) + '...');
    } else {
      fs.writeFileSync(this.filePath, this.migratedContent, 'utf-8');
      console.log('\n✅ File saved successfully');
    }
  }
  
  getDiff(): string {
    return `Original length: ${this.originalContent.length} chars\nMigrated length: ${this.migratedContent.length} chars\nChanges: ${this.changes.length}`;
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

function findComponentsToMigrate(dir: string, extensions: string[] = ['.tsx', '.ts']): string[] {
  const files: string[] = [];
  
  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (
          content.includes('supabase.co/functions/v1/make-server') ||
          content.includes('projectId, publicAnonKey')
        ) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

function batchMigrate(files: string[], dryRun: boolean = false): void {
  console.log('\n🚀 BATCH MIGRATION STARTED');
  console.log('='.repeat(80));
  console.log(`📂 Total files to migrate: ${files.length}`);
  console.log(`🔧 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  
  const results = {
    total: files.length,
    migrated: 0,
    skipped: 0,
    failed: 0
  };
  
  for (const file of files) {
    try {
      const migrator = new ComponentMigrator(file);
      const changed = migrator.migrate();
      
      if (changed) {
        migrator.save(dryRun);
        results.migrated++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      console.error(`\n❌ Error migrating ${file}:`, error);
      results.failed++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Migrated: ${results.migrated}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📁 Total: ${results.total}`);
  console.log('='.repeat(80));
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const componentPath = args.find(arg => !arg.startsWith('--'));
  
  console.log('\n🔄 WARMPAWZ - BATCH MIGRATION TO MOCKAPI');
  console.log('='.repeat(80));
  
  if (componentPath) {
    // Single file migration
    if (!fs.existsSync(componentPath)) {
      console.error(`❌ File not found: ${componentPath}`);
      process.exit(1);
    }
    
    const migrator = new ComponentMigrator(componentPath);
    migrator.migrate();
    migrator.save(dryRun);
  } else {
    // Batch migration
    const customerComponents = findComponentsToMigrate('components/customer');
    const vendorComponents = findComponentsToMigrate('components/vendor');
    const adminComponents = findComponentsToMigrate('components/admin');
    
    const allComponents = [...customerComponents, ...vendorComponents, ...adminComponents];
    
    console.log('\n📋 Components found:');
    console.log(`   Customer: ${customerComponents.length}`);
    console.log(`   Vendor: ${vendorComponents.length}`);
    console.log(`   Admin: ${adminComponents.length}`);
    
    if (allComponents.length === 0) {
      console.log('\n✅ No components need migration!');
      return;
    }
    
    batchMigrate(allComponents, dryRun);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ComponentMigrator, findComponentsToMigrate, batchMigrate };
