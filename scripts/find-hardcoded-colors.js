#!/usr/bin/env node

/**
 * Find Hardcoded Colors Script
 * Scans codebase for hardcoded color values that should use design tokens
 * 
 * Usage: node scripts/find-hardcoded-colors.js [path]
 */

const fs = require('fs');
const path = require('path');

const DESIGN_TOKENS = {
  primary: '#FF8C42',
  primaryLight: '#FFA366',
  primaryDark: '#FF6B35',
  // Add all design token colors here
};

const HARDCODED_COLOR_PATTERNS = [
  /#[0-9A-Fa-f]{6}/g,  // Hex colors
  /#[0-9A-Fa-f]{3}/g,  // Short hex colors
  /rgb\([^)]+\)/g,     // RGB colors
  /rgba\([^)]+\)/g,    // RGBA colors
  /color:\s*['"](#[0-9A-Fa-f]{3,6}|rgb|rgba)['"]/g,  // Inline styles
  /backgroundColor:\s*['"](#[0-9A-Fa-f]{3,6}|rgb|rgba)['"]/g,
  /borderColor:\s*['"](#[0-9A-Fa-f]{3,6}|rgb|rgba)['"]/g,
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /\.git/,
  /packages\/ui\/src\/tokens/,  // Design tokens themselves
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function findHardcodedColors(content, filePath) {
  const issues = [];
  
  HARDCODED_COLOR_PATTERNS.forEach((pattern, index) => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const color = match[0];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1];
      
      // Skip if it's a design token reference
      if (color in DESIGN_TOKENS || Object.values(DESIGN_TOKENS).includes(color)) {
        continue;
      }
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }
      
      issues.push({
        file: filePath,
        line: lineNumber,
        color,
        context: line.trim(),
      });
    }
  });
  
  return issues;
}

function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    if (shouldExclude(filePath)) {
      continue;
    }
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath, results);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const issues = findHardcodedColors(content, filePath);
        results.push(...issues);
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }
  }
  
  return results;
}

function main() {
  const startPath = process.argv[2] || process.cwd();
  const targetDirs = [
    path.join(startPath, 'apps/customer-web'),
    path.join(startPath, 'apps/vendor-web'),
    path.join(startPath, 'apps/admin-web'),
    path.join(startPath, 'apps/WarmpawzCustomer'),
    path.join(startPath, 'apps/WarmpawzVendor'),
  ].filter(dir => fs.existsSync(dir));
  
  console.log('🔍 Scanning for hardcoded colors...\n');
  
  const allIssues = [];
  targetDirs.forEach(dir => {
    console.log(`Scanning: ${dir}`);
    const issues = scanDirectory(dir);
    allIssues.push(...issues);
  });
  
  console.log(`\n📊 Found ${allIssues.length} hardcoded color instances\n`);
  
  // Group by file
  const byFile = {};
  allIssues.forEach(issue => {
    if (!byFile[issue.file]) {
      byFile[issue.file] = [];
    }
    byFile[issue.file].push(issue);
  });
  
  // Print summary
  Object.entries(byFile).forEach(([file, issues]) => {
    console.log(`\n📄 ${file} (${issues.length} issues)`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`   Line ${issue.line}: ${issue.color}`);
      console.log(`   ${issue.context.substring(0, 80)}...`);
    });
    if (issues.length > 5) {
      console.log(`   ... and ${issues.length - 5} more`);
    }
  });
  
  // Write report
  const reportPath = path.join(startPath, 'hardcoded-colors-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    total: allIssues.length,
    byFile,
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log(`\n✅ Report saved to: ${reportPath}`);
}

main();

