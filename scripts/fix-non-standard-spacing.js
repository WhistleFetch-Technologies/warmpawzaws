#!/usr/bin/env node
/**
 * Automated Script to Fix Non-Standard Spacing
 * Standardizes spacing values to design system (4px base unit)
 * 
 * Usage: node scripts/fix-non-standard-spacing.js
 */

const fs = require('fs');
const path = require('path');

// Design system spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] (4px base)
const APPROVED_SPACING = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

// Tailwind spacing scale (in px): 0=0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64
const TAILWIND_SPACING = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64
};

/**
 * Round spacing value to nearest approved value
 */
function roundToApprovedSpacing(value) {
  const nearest = APPROVED_SPACING.reduce((prev, curr) => {
    return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
  });
  return nearest;
}

/**
 * Convert px value to Tailwind class
 */
function pxToTailwind(px) {
  const rounded = roundToApprovedSpacing(px);
  // Find Tailwind class
  for (const [classNum, pxValue] of Object.entries(TAILWIND_SPACING)) {
    if (pxValue === rounded) {
      return classNum;
    }
  }
  return null;
}

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  replacements: 0,
  errors: [],
};

// Directories to process
const DIRECTORIES = [
  'apps/customer-web/components',
  'apps/vendor-web/components',
  'apps/admin-web/components',
  'apps/WarmpawzCustomer/src/screens',
  'apps/WarmpawzVendor/src/screens',
];

/**
 * Get all .tsx files in directory
 */
function getAllTsxFiles(dir) {
  const files = [];
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  try {
    walkDir(dir);
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * Replace non-standard spacing in file content
 */
function replaceSpacing(content, filePath) {
  let modified = false;
  let newContent = content;
  const fileReplacements = [];
  
  // Pattern: p-{number}, px-{number}, py-{number}, pt-{number}, pb-{number}, pl-{number}, pr-{number}
  // Pattern: m-{number}, mx-{number}, my-{number}, mt-{number}, mb-{number}, ml-{number}, mr-{number}
  // Pattern: gap-{number}
  
  const spacingPatterns = [
    { pattern: /(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-(\d+)/g, type: 'Tailwind class' },
    { pattern: /padding:\s*(\d+)px/gi, type: 'CSS padding' },
    { pattern: /margin:\s*(\d+)px/gi, type: 'CSS margin' },
    { pattern: /gap:\s*(\d+)px/gi, type: 'CSS gap' },
  ];
  
  for (const { pattern, type } of spacingPatterns) {
    const matches = [...content.matchAll(pattern)];
    
    for (const match of matches) {
      const fullMatch = match[0];
      const value = parseInt(match[2] || match[1]);
      
      // Check if value is in approved list
      if (!APPROVED_SPACING.includes(value)) {
        const rounded = roundToApprovedSpacing(value);
        const tailwindClass = pxToTailwind(rounded);
        
        if (type === 'Tailwind class') {
          // Replace with rounded Tailwind class
          const prefix = match[1];
          const newClass = `${prefix}-${tailwindClass}`;
          newContent = newContent.replace(fullMatch, newClass);
          fileReplacements.push({ old: fullMatch, new: newClass, type });
          modified = true;
        } else {
          // Replace CSS with rounded value
          const newValue = `${rounded}px`;
          newContent = newContent.replace(fullMatch, fullMatch.replace(`${value}px`, newValue));
          fileReplacements.push({ old: fullMatch, new: fullMatch.replace(`${value}px`, newValue), type });
          modified = true;
        }
      }
    }
  }
  
  return { modified, newContent, replacements: fileReplacements };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    stats.filesProcessed++;
    
    // Read file
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if file has spacing classes
    const hasSpacing = /(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\d+|padding:|margin:|gap:/i.test(content);
    if (!hasSpacing) {
      return; // Skip files without spacing
    }
    
    // Create backup
    const backupPath = filePath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf-8');
    }
    
    // Replace spacing
    const { modified, newContent, replacements } = replaceSpacing(content, filePath);
    
    if (modified) {
      // Write modified content
      fs.writeFileSync(filePath, newContent, 'utf-8');
      stats.filesModified++;
      stats.replacements += replacements.length;
      
      console.log(`✅ Fixed ${filePath}`);
      replacements.slice(0, 5).forEach(r => {
        console.log(`   - ${r.old} → ${r.new} (${r.type})`);
      });
      if (replacements.length > 5) {
        console.log(`   ... and ${replacements.length - 5} more`);
      }
    }
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('📏 Starting automated spacing standardization...\n');
  
  // Get all files
  const allFiles = [];
  for (const dir of DIRECTORIES) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      const files = getAllTsxFiles(fullPath);
      allFiles.push(...files);
      console.log(`📁 Found ${files.length} files in ${dir}`);
    } else {
      console.log(`⚠️  Directory not found: ${dir}`);
    }
  }
  
  console.log(`\n📊 Total files to process: ${allFiles.length}\n`);
  
  // Process each file
  for (const file of allFiles) {
    processFile(file);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Total replacements: ${stats.replacements}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => {
      console.log(`   - ${e.file}: ${e.error}`);
    });
  }
  
  console.log('\n✅ Spacing standardization complete!');
  console.log('💡 Backup files created with .backup extension');
  console.log('💡 Review changes before committing');
}

// Run
if (require.main === module) {
  main();
}

module.exports = { replaceSpacing, roundToApprovedSpacing };

