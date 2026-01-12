#!/usr/bin/env node

/**
 * BATCH MIGRATION SCRIPT (JavaScript)
 * Converts Supabase/Backend calls to MockAPI across all components
 * 
 * Usage: node scripts/migrate-to-mock.js [options]
 * Options:
 *   --dry-run          Preview changes without saving
 *   --file <path>      Migrate single file
 *   --customer         Migrate only customer components
 *   --vendor           Migrate only vendor components
 *   --admin            Migrate only admin components
 *   --all              Migrate all components (default)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  componentsDir: path.join(process.cwd(), 'components'),
  backupDir: path.join(process.cwd(), 'backups'),
  createBackups: true,
  extensions: ['.tsx', '.ts']
};

// ============================================================================
// MIGRATION PATTERNS
// ============================================================================

const SIMPLE_REPLACEMENTS = [
  // Remove Supabase imports
  {
    from: /import\s+{\s*projectId,?\s*publicAnonKey\s*}\s+from\s+['"].*supabase\/info['"]\s*;?\n?/g,
    to: '',
    desc: 'Remove Supabase imports'
  },
  
  // Remove API_BASE constants
  {
    from: /const\s+API_BASE\s*=\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475`\s*;?\n?/g,
    to: '',
    desc: 'Remove API_BASE constant'
  },
  
  // Remove BASE_URL constants
  {
    from: /const\s+BASE_URL\s*=\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475`\s*;?\n?/g,
    to: '',
    desc: 'Remove BASE_URL constant'
  },
  
  // Remove Authorization headers
  {
    from: /,?\s*headers:\s*{\s*['"]Authorization['"]\s*:\s*`Bearer\s+\$\{publicAnonKey\}`\s*}/g,
    to: '',
    desc: 'Remove Authorization headers'
  }
];

const ENDPOINT_REPLACEMENTS = [
  // Customer bookings
  {
    from: /await\s+fetch\(\s*`\$\{API_BASE\}\/customer\/bookings\/\$\{([^}]+)\}`[^)]*\)/g,
    to: 'await MockAPI.customer.getBookings($1)',
    desc: 'Customer bookings → MockAPI'
  },
  
  // Customer pets
  {
    from: /await\s+fetch\(\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475\/customer\/pets\/\$\{([^}]+)\}`[^)]*\)/g,
    to: 'await MockAPI.customer.getPets($1)',
    desc: 'Customer pets → MockAPI'
  },
  
  // Booking details
  {
    from: /await\s+fetch\(\s*`\$\{API_BASE\}\/bookings\/\$\{([^}]+)\}`[^)]*\)/g,
    to: 'await MockAPI.booking.getBooking($1)',
    desc: 'Booking details → MockAPI'
  },
  
  // Cancel booking
  {
    from: /await\s+fetch\(\s*`\$\{API_BASE\}\/bookings\/\$\{([^}]+)\}\/cancel`[^)]*\)/g,
    to: 'await MockAPI.booking.cancelBooking($1)',
    desc: 'Cancel booking → MockAPI'
  },
  
  // Discover services
  {
    from: /await\s+fetch\(\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475\/customer\/discover-services[^`]*`[^)]*\)/g,
    to: 'await MockAPI.search.searchVendors({})',
    desc: 'Discover services → MockAPI'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createBackup(filePath) {
  if (!CONFIG.createBackups) return;
  
  const backupDir = CONFIG.backupDir;
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `${path.basename(filePath)}.${timestamp}.backup`;
  const backupPath = path.join(backupDir, backupFileName);
  
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function needsMigration(content) {
  return (
    content.includes('supabase.co/functions/v1/make-server') ||
    content.includes('projectId, publicAnonKey') ||
    (content.includes('API_BASE') && content.includes('supabase'))
  );
}

function addMockAPIImport(content) {
  // Check if MockAPI is already imported
  if (content.includes("import MockAPI from")) {
    return content;
  }
  
  // Find the last import statement
  const importMatches = [...content.matchAll(/import\s+.*from\s+['"][^'"]+['"]\s*;?\n/g)];
  if (importMatches.length === 0) {
    // No imports found, add at top
    return `import MockAPI from '../../lib/mockAPI';\nimport { toast } from 'sonner@2.0.3';\n\n${content}`;
  }
  
  // Add after last import
  const lastImport = importMatches[importMatches.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  
  return (
    content.substring(0, insertPos) +
    `import MockAPI from '../../lib/mockAPI';\n` +
    (content.includes("import { toast }") ? '' : `import { toast } from 'sonner@2.0.3';\n`) +
    content.substring(insertPos)
  );
}

function cleanupContent(content) {
  // Remove multiple consecutive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // Remove trailing whitespace
  content = content.split('\n').map(line => line.trimEnd()).join('\n');
  
  return content;
}

// ============================================================================
// MIGRATION CLASS
// ============================================================================

class ComponentMigrator {
  constructor(filePath) {
    this.filePath = filePath;
    this.originalContent = fs.readFileSync(filePath, 'utf-8');
    this.migratedContent = this.originalContent;
    this.changes = [];
  }
  
  migrate() {
    console.log(`\n📝 ${path.relative(process.cwd(), this.filePath)}`);
    
    if (!needsMigration(this.originalContent)) {
      console.log('   ✓ Already migrated or no Supabase references');
      return false;
    }
    
    // Apply simple replacements
    for (const replacement of SIMPLE_REPLACEMENTS) {
      const before = this.migratedContent;
      this.migratedContent = this.migratedContent.replace(replacement.from, replacement.to);
      if (before !== this.migratedContent) {
        this.changes.push(replacement.desc);
      }
    }
    
    // Apply endpoint replacements
    for (const replacement of ENDPOINT_REPLACEMENTS) {
      const before = this.migratedContent;
      this.migratedContent = this.migratedContent.replace(replacement.from, replacement.to);
      if (before !== this.migratedContent) {
        this.changes.push(replacement.desc);
      }
    }
    
    // Add MockAPI import if needed
    if (this.changes.length > 0) {
      this.migratedContent = addMockAPIImport(this.migratedContent);
      this.changes.push('Add MockAPI import');
    }
    
    // Cleanup
    this.migratedContent = cleanupContent(this.migratedContent);
    
    return this.changes.length > 0;
  }
  
  save(dryRun = false) {
    if (this.changes.length === 0) {
      return;
    }
    
    this.changes.forEach(change => {
      console.log(`   ✓ ${change}`);
    });
    
    if (dryRun) {
      console.log('   ⚠️  [DRY RUN] Changes not saved');
    } else {
      const backupPath = createBackup(this.filePath);
      fs.writeFileSync(this.filePath, this.migratedContent, 'utf-8');
      console.log(`   ✅ Saved (backup: ${path.basename(backupPath)})`);
    }
  }
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

function findComponentFiles(dir) {
  const files = [];
  
  function scan(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (needsMigration(content)) {
            files.push(fullPath);
          }
        } catch (err) {
          console.error(`Error reading ${fullPath}:`, err.message);
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

function batchMigrate(files, dryRun = false) {
  console.log('\n🚀 BATCH MIGRATION STARTED');
  console.log('='.repeat(80));
  console.log(`📂 Files to process: ${files.length}`);
  console.log(`🔧 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(80));
  
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
      console.error(`\n❌ Error: ${file}`, error.message);
      results.failed++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Migrated:  ${results.migrated}`);
  console.log(`⏭️  Skipped:   ${results.skipped}`);
  console.log(`❌ Failed:    ${results.failed}`);
  console.log(`📁 Total:     ${results.total}`);
  
  if (CONFIG.createBackups && results.migrated > 0) {
    console.log(`\n💾 Backups saved to: ${CONFIG.backupDir}`);
  }
  
  console.log('='.repeat(80));
}

// ============================================================================
// MAIN CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleFile = args.find((arg, i) => args[i - 1] === '--file');
  
  console.log('\n🔄 WARMPAWZ - BATCH MIGRATION TO MOCKAPI');
  console.log('='.repeat(80));
  
  if (singleFile) {
    // Single file migration
    if (!fs.existsSync(singleFile)) {
      console.error(`❌ File not found: ${singleFile}`);
      process.exit(1);
    }
    
    const migrator = new ComponentMigrator(singleFile);
    migrator.migrate();
    migrator.save(dryRun);
    return;
  }
  
  // Determine which components to migrate
  let filesToMigrate = [];
  
  if (args.includes('--customer')) {
    filesToMigrate = findComponentFiles(path.join(CONFIG.componentsDir, 'customer'));
  } else if (args.includes('--vendor')) {
    filesToMigrate = findComponentFiles(path.join(CONFIG.componentsDir, 'vendor'));
  } else if (args.includes('--admin')) {
    filesToMigrate = findComponentFiles(path.join(CONFIG.componentsDir, 'admin'));
  } else {
    // Default: all components
    const customer = findComponentFiles(path.join(CONFIG.componentsDir, 'customer'));
    const vendor = findComponentFiles(path.join(CONFIG.componentsDir, 'vendor'));
    const admin = findComponentFiles(path.join(CONFIG.componentsDir, 'admin'));
    
    console.log('\n📋 Components found:');
    console.log(`   Customer:  ${customer.length}`);
    console.log(`   Vendor:    ${vendor.length}`);
    console.log(`   Admin:     ${admin.length}`);
    
    filesToMigrate = [...customer, ...vendor, ...admin];
  }
  
  if (filesToMigrate.length === 0) {
    console.log('\n✅ No components need migration!');
    return;
  }
  
  batchMigrate(filesToMigrate, dryRun);
}

// Run
main();
