#!/usr/bin/env node
/**
 * Automated Script to Fix Hardcoded Colors
 * Replaces hardcoded hex colors with design tokens
 * 
 * Usage: node scripts/fix-hardcoded-colors-automated.js
 */

const fs = require('fs');
const path = require('path');

// Color mappings: hardcoded hex → design token
const COLOR_MAPPINGS = {
  // Primary colors (orange)
  '#f97316': { token: 'colors.primary', tailwind: 'bg-primary', text: 'text-primary' },
  '#F97316': { token: 'colors.primary', tailwind: 'bg-primary', text: 'text-primary' },
  '#FF8C42': { token: 'colors.primary', tailwind: 'bg-primary', text: 'text-primary' },
  '#ff8c42': { token: 'colors.primary', tailwind: 'bg-primary', text: 'text-primary' },
  
  // White
  '#fff': { token: 'colors.white', tailwind: 'bg-white', text: 'text-white' },
  '#FFF': { token: 'colors.white', tailwind: 'bg-white', text: 'text-white' },
  '#ffffff': { token: 'colors.white', tailwind: 'bg-white', text: 'text-white' },
  '#FFFFFF': { token: 'colors.white', tailwind: 'bg-white', text: 'text-white' },
  
  // Gray backgrounds
  '#f3f4f6': { token: 'colors.gray.100', tailwind: 'bg-gray-100', text: 'text-gray-100' },
  '#F3F4F6': { token: 'colors.gray.100', tailwind: 'bg-gray-100', text: 'text-gray-100' },
  '#e5e7eb': { token: 'colors.gray.200', tailwind: 'bg-gray-200', text: 'text-gray-200' },
  '#E5E7EB': { token: 'colors.gray.200', tailwind: 'bg-gray-200', text: 'text-gray-200' },
  '#9ca3af': { token: 'colors.gray.400', tailwind: 'bg-gray-400', text: 'text-gray-400' },
  '#9CA3AF': { token: 'colors.gray.400', tailwind: 'bg-gray-400', text: 'text-gray-400' },
  
  // Error colors
  '#fee2e2': { token: 'colors.error + 20% opacity', tailwind: 'bg-red-50', text: 'text-red-50' },
  '#FEE2E2': { token: 'colors.error + 20% opacity', tailwind: 'bg-red-50', text: 'text-red-50' },
  '#dc2626': { token: 'colors.error', tailwind: 'bg-red-600', text: 'text-red-600' },
  '#DC2626': { token: 'colors.error', tailwind: 'bg-red-600', text: 'text-red-600' },
  
  // Success colors
  '#10b981': { token: 'colors.success', tailwind: 'bg-green-500', text: 'text-green-500' },
  '#10B981': { token: 'colors.success', tailwind: 'bg-green-500', text: 'text-green-500' },
  
  // Primary light variants
  '#fff4e6': { token: 'colors.primary.50', tailwind: 'bg-primary-50', text: 'text-primary-50' },
  '#FFF4E6': { token: 'colors.primary.50', tailwind: 'bg-primary-50', text: 'text-primary-50' },
  '#fff7ed': { token: 'colors.primary.50', tailwind: 'bg-primary-50', text: 'text-primary-50' },
  '#FFF7ED': { token: 'colors.primary.50', tailwind: 'bg-primary-50', text: 'text-primary-50' },
  
  // Black
  '#000': { token: 'colors.black', tailwind: 'bg-black', text: 'text-black' },
  '#000000': { token: 'colors.black', tailwind: 'bg-black', text: 'text-black' },
  '#000000': { token: 'colors.black', tailwind: 'bg-black', text: 'text-black' },
};

// Directories to process
const DIRECTORIES = [
  'apps/customer-web/components',
  'apps/vendor-web/components',
  'apps/admin-web/components',
  'apps/WarmpawzCustomer/src/screens',
  'apps/WarmpawzVendor/src/screens',
];

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  replacements: 0,
  errors: [],
};

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
 * Replace hardcoded colors in file content
 */
function replaceColors(content, filePath) {
  let modified = false;
  let newContent = content;
  const fileReplacements = [];
  
  // Replace in inline styles (color: '#hex' or backgroundColor: '#hex')
  for (const [hex, mapping] of Object.entries(COLOR_MAPPINGS)) {
    // Pattern: color: '#hex' or backgroundColor: '#hex'
    const stylePattern = new RegExp(`(color|backgroundColor|borderColor|fill|stroke):\\s*['"]${hex.replace('#', '\\#')}['"]`, 'gi');
    
    if (stylePattern.test(newContent)) {
      modified = true;
      newContent = newContent.replace(stylePattern, (match, prop) => {
        fileReplacements.push({ hex, prop, replacement: mapping.token });
        // For mobile apps, use colors.token, for web use className
        if (filePath.includes('WarmpawzCustomer') || filePath.includes('WarmpawzVendor')) {
          return `${prop}: ${mapping.token}`;
        } else {
          // For web, we'll keep the style but suggest using className
          return `${prop}: ${mapping.token}`;
        }
      });
    }
    
    // Pattern: '#hex' in JSX attributes (fill="#hex", stroke="#hex")
    const jsxAttrPattern = new RegExp(`(['"]${hex.replace('#', '\\#')}['"])`, 'g');
    if (jsxAttrPattern.test(newContent)) {
      modified = true;
      newContent = newContent.replace(jsxAttrPattern, (match) => {
        fileReplacements.push({ hex, prop: 'JSX attribute', replacement: mapping.token });
        // For SVG attributes, use the token
        if (filePath.includes('WarmpawzCustomer') || filePath.includes('WarmpawzVendor')) {
          return `{${mapping.token}}`;
        } else {
          return `{${mapping.token}}`;
        }
      });
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
    
    // Check if file has hardcoded colors
    const hasHardcodedColor = /#[0-9A-Fa-f]{6}/i.test(content);
    if (!hasHardcodedColor) {
      return; // Skip files without hardcoded colors
    }
    
    // Create backup
    const backupPath = filePath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf-8');
    }
    
    // Replace colors
    const { modified, newContent, replacements } = replaceColors(content, filePath);
    
    if (modified) {
      // Write modified content
      fs.writeFileSync(filePath, newContent, 'utf-8');
      stats.filesModified++;
      stats.replacements += replacements.length;
      
      console.log(`✅ Fixed ${filePath}`);
      replacements.forEach(r => {
        console.log(`   - ${r.hex} (${r.prop}) → ${r.replacement}`);
      });
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
  console.log('🎨 Starting automated color replacement...\n');
  
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
  
  console.log('\n✅ Color replacement complete!');
  console.log('💡 Backup files created with .backup extension');
  console.log('💡 Review changes before committing');
}

// Run
if (require.main === module) {
  main();
}

module.exports = { replaceColors, COLOR_MAPPINGS };

