#!/usr/bin/env node

/**
 * COMPONENT ANALYSIS SCRIPT
 * Analyzes components to identify migration needs
 * 
 * Usage: node scripts/analyze-components.js [options]
 * Options:
 *   --verbose    Show detailed pattern matches
 *   --customer   Analyze only customer components
 *   --vendor     Analyze only vendor components  
 *   --admin      Analyze only admin components
 *   --json       Output as JSON
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// PATTERNS TO DETECT
// ============================================================================

const PATTERNS = {
  supabaseImports: /import\s+{\s*projectId,?\s*publicAnonKey\s*}\s+from\s+['"].*supabase\/info['"]/g,
  apiBase: /const\s+(API_BASE|BASE_URL)\s*=\s*`https:\/\/\$\{projectId\}\.supabase\.co/g,
  fetchCalls: /await\s+fetch\(\s*`https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-3dd53475/g,
  authHeaders: /['"]Authorization['"]\s*:\s*`Bearer\s+\$\{publicAnonKey\}`/g,
  mockApiImports: /import\s+MockAPI\s+from/g,
  
  // Specific endpoint patterns
  customerEndpoints: /\/customer\/(bookings|pets|profile|wallet)/g,
  bookingEndpoints: /\/bookings\/[^`]*/g,
  vendorEndpoints: /\/vendor\/(dashboard|services|staff)/g,
  ecommerceEndpoints: /\/(products|orders|cart)/g,
  aiEndpoints: /\/ai\/(chat|recommend)/g,
};

// ============================================================================
// FILE SCANNER
// ============================================================================

class ComponentAnalyzer {
  constructor(filePath) {
    this.filePath = filePath;
    this.relativePath = path.relative(process.cwd(), filePath);
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.findings = {
      needsMigration: false,
      isMigrated: false,
      patterns: {},
      endpoints: [],
      complexity: 'low',
      estimatedEffort: 'easy'
    };
  }
  
  analyze() {
    // Check if already migrated
    if (this.content.match(PATTERNS.mockApiImports)) {
      this.findings.isMigrated = true;
      
      // Check if there are still Supabase references (partial migration)
      if (this.content.match(PATTERNS.supabaseImports) || 
          this.content.match(PATTERNS.fetchCalls)) {
        this.findings.needsMigration = true;
        this.findings.complexity = 'medium';
        this.findings.estimatedEffort = 'partial-migration';
      }
    } else {
      // Check for patterns that need migration
      for (const [name, pattern] of Object.entries(PATTERNS)) {
        if (name === 'mockApiImports') continue;
        
        const matches = [...this.content.matchAll(pattern)];
        if (matches.length > 0) {
          this.findings.needsMigration = true;
          this.findings.patterns[name] = matches.length;
        }
      }
    }
    
    // Extract endpoints
    this.extractEndpoints();
    
    // Estimate complexity
    this.estimateComplexity();
    
    return this.findings;
  }
  
  extractEndpoints() {
    const endpointPattern = /\/make-server-3dd53475(\/[^`"'\s]+)/g;
    const matches = [...this.content.matchAll(endpointPattern)];
    
    this.findings.endpoints = [...new Set(matches.map(m => m[1]))];
  }
  
  estimateComplexity() {
    const fetchCount = (this.findings.patterns.fetchCalls || 0);
    const endpointCount = this.findings.endpoints.length;
    
    if (fetchCount === 0 && endpointCount === 0) {
      this.findings.complexity = 'none';
      this.findings.estimatedEffort = 'none';
    } else if (fetchCount <= 2 && endpointCount <= 2) {
      this.findings.complexity = 'low';
      this.findings.estimatedEffort = 'easy';
    } else if (fetchCount <= 5 && endpointCount <= 4) {
      this.findings.complexity = 'medium';
      this.findings.estimatedEffort = 'moderate';
    } else {
      this.findings.complexity = 'high';
      this.findings.estimatedEffort = 'complex';
    }
    
    // Increase complexity if custom error handling
    if (this.content.includes('response.ok') && this.content.includes('catch')) {
      this.findings.complexity = 'medium';
    }
    
    // Increase for state management complexity
    const stateCount = (this.content.match(/useState/g) || []).length;
    if (stateCount > 5) {
      this.findings.complexity = 'high';
    }
  }
  
  getReport(verbose = false) {
    const status = this.findings.isMigrated ? '✅' : 
                   this.findings.needsMigration ? '🔴' : '⚪';
    
    let report = `${status} ${this.relativePath}\n`;
    
    if (this.findings.isMigrated && !this.findings.needsMigration) {
      report += `   Already migrated\n`;
      return report;
    }
    
    if (!this.findings.needsMigration) {
      report += `   No migration needed\n`;
      return report;
    }
    
    report += `   Complexity: ${this.findings.complexity.toUpperCase()} (${this.findings.estimatedEffort})\n`;
    
    if (verbose) {
      report += `   Patterns found:\n`;
      for (const [pattern, count] of Object.entries(this.findings.patterns)) {
        report += `      - ${pattern}: ${count}\n`;
      }
      
      if (this.findings.endpoints.length > 0) {
        report += `   Endpoints:\n`;
        this.findings.endpoints.forEach(ep => {
          report += `      - ${ep}\n`;
        });
      }
    }
    
    return report;
  }
}

// ============================================================================
// DIRECTORY SCANNER
// ============================================================================

function scanDirectory(dir) {
  const files = [];
  
  function scan(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(results, verbose = false, jsonOutput = false) {
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  const total = results.length;
  const migrated = results.filter(r => r.findings.isMigrated && !r.findings.needsMigration).length;
  const needsMigration = results.filter(r => r.findings.needsMigration).length;
  const noMigrationNeeded = total - migrated - needsMigration;
  
  console.log('\n📊 COMPONENT ANALYSIS REPORT');
  console.log('='.repeat(80));
  console.log(`📁 Total files:           ${total}`);
  console.log(`✅ Already migrated:      ${migrated}`);
  console.log(`🔴 Needs migration:       ${needsMigration}`);
  console.log(`⚪ No migration needed:   ${noMigrationNeeded}`);
  console.log('='.repeat(80));
  
  // Group by complexity
  const byComplexity = {
    high: results.filter(r => r.findings.complexity === 'high').length,
    medium: results.filter(r => r.findings.complexity === 'medium').length,
    low: results.filter(r => r.findings.complexity === 'low').length,
    none: results.filter(r => r.findings.complexity === 'none').length
  };
  
  console.log('\n🎯 COMPLEXITY BREAKDOWN');
  console.log('='.repeat(80));
  console.log(`🔥 High complexity:       ${byComplexity.high} files (manual review recommended)`);
  console.log(`⚡ Medium complexity:     ${byComplexity.medium} files (script + review)`);
  console.log(`✨ Low complexity:        ${byComplexity.low} files (script can handle)`);
  console.log(`⚪ No migration:          ${byComplexity.none} files`);
  console.log('='.repeat(80));
  
  // Show files that need migration
  const toMigrate = results.filter(r => r.findings.needsMigration);
  
  if (toMigrate.length > 0) {
    console.log('\n📋 FILES NEEDING MIGRATION');
    console.log('='.repeat(80));
    
    // Sort by complexity
    toMigrate.sort((a, b) => {
      const complexityOrder = { low: 1, medium: 2, high: 3 };
      return complexityOrder[a.findings.complexity] - complexityOrder[b.findings.complexity];
    });
    
    toMigrate.forEach(result => {
      console.log(result.getReport(verbose));
    });
  }
  
  // Show recommended migration order
  console.log('\n💡 RECOMMENDED MIGRATION ORDER');
  console.log('='.repeat(80));
  console.log('1. Run batch script on LOW complexity files first');
  console.log('2. Review and test those migrations');
  console.log('3. Run batch script on MEDIUM complexity files');
  console.log('4. Manually migrate HIGH complexity files');
  console.log('5. Run final verification');
  console.log('='.repeat(80));
  
  // Show pattern statistics
  console.log('\n📈 PATTERN STATISTICS');
  console.log('='.repeat(80));
  
  const allPatterns = {};
  results.forEach(r => {
    Object.entries(r.findings.patterns).forEach(([pattern, count]) => {
      allPatterns[pattern] = (allPatterns[pattern] || 0) + count;
    });
  });
  
  Object.entries(allPatterns)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`${pattern.padEnd(25)} ${count} occurrences`);
    });
  
  console.log('='.repeat(80));
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const jsonOutput = args.includes('--json');
  
  console.log('\n🔍 WARMPAWZ - COMPONENT MIGRATION ANALYSIS');
  console.log('='.repeat(80));
  
  // Determine which directories to scan
  let directories = [];
  const componentsDir = path.join(process.cwd(), 'components');
  
  if (args.includes('--customer')) {
    directories.push(path.join(componentsDir, 'customer'));
  } else if (args.includes('--vendor')) {
    directories.push(path.join(componentsDir, 'vendor'));
  } else if (args.includes('--admin')) {
    directories.push(path.join(componentsDir, 'admin'));
  } else {
    directories = [
      path.join(componentsDir, 'customer'),
      path.join(componentsDir, 'vendor'),
      path.join(componentsDir, 'admin')
    ];
  }
  
  // Scan all files
  const allFiles = directories.flatMap(dir => scanDirectory(dir));
  
  console.log(`Scanning ${allFiles.length} files...`);
  
  // Analyze each file
  const results = allFiles.map(file => {
    const analyzer = new ComponentAnalyzer(file);
    analyzer.analyze();
    return analyzer;
  });
  
  // Generate report
  generateReport(results, verbose, jsonOutput);
}

// Run
main();
