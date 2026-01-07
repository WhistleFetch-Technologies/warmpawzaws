#!/usr/bin/env node

/**
 * Design Audit Analyzer
 * Extracts component, color, layout, and API integration information from all screens
 */

const fs = require('fs');
const path = require('path');

const DESIGN_TOKENS = {
  primary: '#FF8C42',
  primaryLight: '#FFA366',
  primaryDark: '#FF6B35',
  colors: {
    primary: ['#FF8C42', '#FFA366', '#FF6B35', '#FFF5EE', '#FFE8D6'],
    service: {
      veterinary: '#26C6DA',
      grooming: '#FF6B9D',
      training: '#9B59B6',
      boarding: '#FF8C42',
      walking: '#4CAF50',
    },
    semantic: {
      success: '#4CAF50',
      error: '#EF4444',
      warning: '#FFC857',
      info: '#2196F3',
    },
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  borderRadius: [4, 8, 12, 16, 24, 32],
};

function extractColors(content) {
  const colorPatterns = [
    /#[0-9A-Fa-f]{6}/g,
    /bg-(primary|orange|pink|blue|green|purple|teal|gray|red|yellow|green)-\d+/g,
    /text-(primary|orange|pink|blue|green|purple|teal|gray|red|yellow|green)-\d+/g,
    /border-(primary|orange|pink|blue|green|purple|teal|gray|red|yellow|green)-\d+/g,
    /--color-[a-z-]+/g,
  ];
  
  const colors = new Set();
  colorPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => colors.add(m));
    }
  });
  
  return Array.from(colors);
}

function extractComponents(content) {
  const componentPatterns = [
    /<(\w+[A-Z]\w*)\s/g,
    /import\s+.*?from\s+['"](.*?)['"]/g,
    /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g,
  ];
  
  const components = new Set();
  const imports = new Set();
  
  // Extract JSX components
  const jsxMatches = content.matchAll(/<(\w+[A-Z]\w*)\s/g);
  for (const match of jsxMatches) {
    components.add(match[1]);
  }
  
  // Extract imports
  const importMatches = content.matchAll(/import\s+.*?from\s+['"](.*?)['"]/g);
  for (const match of importMatches) {
    imports.add(match[1]);
  }
  
  return {
    components: Array.from(components),
    imports: Array.from(imports),
  };
}

function extractLayoutClasses(content) {
  const layoutPatterns = [
    /(flex|grid|block|inline|hidden)/g,
    /(flex-col|flex-row|flex-wrap)/g,
    /(items-center|items-start|items-end|justify-center|justify-between|justify-around)/g,
    /(gap-\d+|space-[xy]-\d+)/g,
    /(p-\d+|px-\d+|py-\d+|pt-\d+|pb-\d+|pl-\d+|pr-\d+)/g,
    /(m-\d+|mx-\d+|my-\d+|mt-\d+|mb-\d+|ml-\d+|mr-\d+)/g,
    /(w-\w+|h-\w+|max-w-\w+|min-w-\w+|max-h-\w+|min-h-\w+)/g,
    /(rounded-\w+|rounded-\[.*?\])/g,
    /(shadow-\w+|shadow-\[.*?\])/g,
  ];
  
  const layouts = new Set();
  layoutPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => layouts.add(m));
    }
  });
  
  return Array.from(layouts);
}

function extractAPICalls(content) {
  const apiPatterns = [
    /apiClient\.(get|post|put|delete|patch)\(['"](.*?)['"]/g,
    /fetch\(['"](.*?)['"]/g,
    /axios\.(get|post|put|delete|patch)\(['"](.*?)['"]/g,
  ];
  
  const apiCalls = [];
  
  apiPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      apiCalls.push({
        method: match[1] || 'GET',
        endpoint: match[2] || match[1],
      });
    }
  });
  
  return apiCalls;
}

function checkDesignTokenCompliance(colors, layouts) {
  const violations = [];
  const missing = [];
  
  // Check for hardcoded colors
  colors.forEach(color => {
    if (color.startsWith('#') && !Object.values(DESIGN_TOKENS.colors).flat().includes(color)) {
      violations.push({
        type: 'hardcoded_color',
        value: color,
        recommendation: 'Use design token instead',
      });
    }
  });
  
  // Check for non-standard spacing
  const spacingMatches = layouts.filter(l => l.match(/[mp][xy]?-\d+/));
  spacingMatches.forEach(spacing => {
    const value = parseInt(spacing.match(/\d+/)?.[0] || '0');
    if (value > 0 && !DESIGN_TOKENS.spacing.includes(value) && value % 4 !== 0) {
      violations.push({
        type: 'non_standard_spacing',
        value: spacing,
        recommendation: `Use spacing from design system (${DESIGN_TOKENS.spacing.join(', ')})`,
      });
    }
  });
  
  return { violations, missing };
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    const colors = extractColors(content);
    const { components, imports } = extractComponents(content);
    const layouts = extractLayoutClasses(content);
    const apiCalls = extractAPICalls(content);
    const { violations, missing } = checkDesignTokenCompliance(colors, layouts);
    
    // Determine app type
    let appType = 'unknown';
    if (filePath.includes('customer-web')) appType = 'customer-web';
    else if (filePath.includes('vendor-web')) appType = 'vendor-web';
    else if (filePath.includes('admin-web')) appType = 'admin-web';
    else if (filePath.includes('WarmpawzCustomer')) appType = 'customer-mobile';
    else if (filePath.includes('WarmpawzVendor')) appType = 'vendor-mobile';
    
    // Extract screen name
    const fileName = path.basename(filePath, '.tsx');
    const screenName = fileName.replace(/Page|Screen|Component|Client/g, '');
    
    return {
      filePath: relativePath,
      appType,
      screenName,
      colors,
      components,
      imports,
      layouts,
      apiCalls,
      violations,
      missing,
      hasAPIIntegration: apiCalls.length > 0,
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

function findScreenFiles(rootDir) {
  const screenFiles = [];
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and .next
        if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('dist')) {
          walkDir(filePath);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        // Look for page files, screen files, or component files
        if (
          file.includes('page') ||
          file.includes('Page') ||
          file.includes('Screen') ||
          file.includes('screen') ||
          (file.includes('Component') && !file.includes('node_modules'))
        ) {
          screenFiles.push(filePath);
        }
      }
    });
  }
  
  walkDir(rootDir);
  return screenFiles;
}

// Main execution
const appsDir = path.join(process.cwd(), 'apps');
const results = [];

console.log('🔍 Scanning for screen files...');
const screenFiles = findScreenFiles(appsDir);

console.log(`📊 Found ${screenFiles.length} screen files. Analyzing...`);

screenFiles.forEach((file, index) => {
  const result = analyzeFile(file);
  if (result) {
    results.push(result);
  }
  if ((index + 1) % 10 === 0) {
    console.log(`  Processed ${index + 1}/${screenFiles.length} files...`);
  }
});

// Group by app type
const grouped = results.reduce((acc, result) => {
  if (!acc[result.appType]) {
    acc[result.appType] = [];
  }
  acc[result.appType].push(result);
  return acc;
}, {});

// Generate report
const report = {
  summary: {
    totalScreens: results.length,
    byAppType: Object.keys(grouped).reduce((acc, type) => {
      acc[type] = grouped[type].length;
      return acc;
    }, {}),
    totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
    totalAPICalls: results.reduce((sum, r) => sum + r.apiCalls.length, 0),
  },
  screens: results,
  grouped,
};

console.log(`\n✅ Analysis complete!`);
console.log(`   Total screens: ${report.summary.totalScreens}`);
console.log(`   Total violations: ${report.summary.totalViolations}`);
console.log(`   Total API calls: ${report.summary.totalAPICalls}`);

// Write report
const reportPath = path.join(process.cwd(), 'DESIGN_AUDIT_ANALYSIS.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 Report saved to: ${reportPath}`);

