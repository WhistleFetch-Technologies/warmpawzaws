#!/usr/bin/env node

/**
 * Generate Comprehensive Pixel-Perfect Design Comparison Report
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

function calculateMatchingPercentage(screen) {
  let score = 100;
  let deductions = 0;
  
  // Deduct for violations
  deductions += screen.violations.length * 2;
  
  // Deduct for missing API integration (if screen should have it)
  if (screen.screenName.toLowerCase().includes('booking') || 
      screen.screenName.toLowerCase().includes('service') ||
      screen.screenName.toLowerCase().includes('vendor') ||
      screen.screenName.toLowerCase().includes('dashboard')) {
    if (!screen.hasAPIIntegration) {
      deductions += 10;
    }
  }
  
  // Deduct for hardcoded colors
  const hardcodedColors = screen.violations.filter(v => v.type === 'hardcoded_color').length;
  deductions += hardcodedColors * 1;
  
  score = Math.max(0, score - deductions);
  return Math.round(score);
}

function categorizeViolations(violations) {
  return {
    hardcodedColors: violations.filter(v => v.type === 'hardcoded_color'),
    nonStandardSpacing: violations.filter(v => v.type === 'non_standard_spacing'),
    other: violations.filter(v => !['hardcoded_color', 'non_standard_spacing'].includes(v.type)),
  };
}

function generateScreenReport(screen) {
  const matchingPercentage = calculateMatchingPercentage(screen);
  const categorizedViolations = categorizeViolations(screen.violations);
  
  return {
    screenName: screen.screenName,
    filePath: screen.filePath,
    appType: screen.appType,
    matchingPercentage,
    components: {
      total: screen.components.length,
      list: screen.components.slice(0, 20), // Top 20
      all: screen.components,
    },
    colors: {
      total: screen.colors.length,
      list: screen.colors.slice(0, 20), // Top 20
      all: screen.colors,
      violations: categorizedViolations.hardcodedColors,
    },
    layouts: {
      total: screen.layouts.length,
      list: screen.layouts.slice(0, 30), // Top 30
      all: screen.layouts,
      violations: categorizedViolations.nonStandardSpacing,
    },
    apiIntegration: {
      status: screen.hasAPIIntegration ? '✅ Integrated' : '❌ Not Integrated',
      totalCalls: screen.apiCalls.length,
      endpoints: screen.apiCalls.map(c => `${c.method} ${c.endpoint}`),
    },
    violations: {
      total: screen.violations.length,
      categorized: categorizedViolations,
      all: screen.violations,
    },
    missing: screen.missing,
  };
}

function generateMarkdownReport(data) {
  const screens = data.screens.map(generateScreenReport);
  
  // Group by app type
  const byAppType = screens.reduce((acc, screen) => {
    if (!acc[screen.appType]) {
      acc[screen.appType] = [];
    }
    acc[screen.appType].push(screen);
    return acc;
  }, {});
  
  let markdown = `# 🎨 PIXEL-PERFECT DESIGN COMPARISON REPORT
## Warmpawz Ecosystem Development - Visual Design Audit

**Generated:** ${new Date().toISOString()}  
**Reference Design:** [Figma - Warmpawz Ecosystem Development](https://www.figma.com/design/YdfuhU9EWz4XDMwBgZf3Q0/Warmpawz-Ecosystem-Development)  
**Total Screens Analyzed:** ${data.summary.totalScreens}  
**Total Violations Found:** ${data.summary.totalViolations}  
**Total API Calls:** ${data.summary.totalAPICalls}

---

## 📊 EXECUTIVE SUMMARY

### Overall Matching Score

| App Type | Screens | Avg Match % | Violations | API Integration |
|----------|---------|-------------|------------|-----------------|
`;

  // Calculate averages per app type
  Object.keys(byAppType).forEach(appType => {
    const appScreens = byAppType[appType];
    const avgMatch = Math.round(
      appScreens.reduce((sum, s) => sum + s.matchingPercentage, 0) / appScreens.length
    );
    const totalViolations = appScreens.reduce((sum, s) => sum + s.violations.total, 0);
    const apiIntegrated = appScreens.filter(s => s.apiIntegration.status.includes('✅')).length;
    const apiPercentage = Math.round((apiIntegrated / appScreens.length) * 100);
    
    markdown += `| ${appType} | ${appScreens.length} | ${avgMatch}% | ${totalViolations} | ${apiPercentage}% |\n`;
  });
  
  markdown += `\n### Key Findings\n\n`;
  markdown += `- **Total Screens:** ${data.summary.totalScreens}\n`;
  markdown += `- **Total Violations:** ${data.summary.totalViolations}\n`;
  markdown += `- **Hardcoded Colors:** ${screens.reduce((sum, s) => sum + s.violations.categorized.hardcodedColors.length, 0)}\n`;
  markdown += `- **Non-Standard Spacing:** ${screens.reduce((sum, s) => sum + s.violations.categorized.nonStandardSpacing.length, 0)}\n`;
  markdown += `- **API Integration Rate:** ${Math.round((data.summary.totalAPICalls / data.summary.totalScreens) * 100)}%\n`;
  
  markdown += `\n---\n\n## 📱 SCREEN-BY-SCREEN ANALYSIS\n\n`;
  
  // Generate detailed report for each app type
  Object.keys(byAppType).forEach(appType => {
    markdown += `### ${appType.toUpperCase()}\n\n`;
    
    const appScreens = byAppType[appType].sort((a, b) => b.matchingPercentage - a.matchingPercentage);
    
    appScreens.forEach((screen, index) => {
      markdown += `#### ${index + 1}. ${screen.screenName}\n\n`;
      markdown += `**File:** \`${screen.filePath}\`\n\n`;
      markdown += `**Matching Percentage:** **${screen.matchingPercentage}%**\n\n`;
      
      // Components
      markdown += `**Components Used (${screen.components.total}):**\n`;
      if (screen.components.list.length > 0) {
        markdown += `\`\`\`\n${screen.components.list.join(', ')}\n\`\`\`\n\n`;
      } else {
        markdown += `*No components detected*\n\n`;
      }
      
      // Colors
      markdown += `**Colors Used (${screen.colors.total}):**\n`;
      if (screen.colors.list.length > 0) {
        markdown += `\`\`\`\n${screen.colors.list.slice(0, 15).join(', ')}\n\`\`\`\n\n`;
      } else {
        markdown += `*No colors detected*\n\n`;
      }
      
      // Layout Classes
      markdown += `**Layout Classes (${screen.layouts.total}):**\n`;
      if (screen.layouts.list.length > 0) {
        markdown += `\`\`\`\n${screen.layouts.list.slice(0, 20).join(', ')}\n\`\`\`\n\n`;
      } else {
        markdown += `*No layout classes detected*\n\n`;
      }
      
      // API Integration
      markdown += `**API Integration:** ${screen.apiIntegration.status}\n`;
      if (screen.apiIntegration.endpoints.length > 0) {
        markdown += `\n**Endpoints:**\n`;
        screen.apiIntegration.endpoints.forEach(endpoint => {
          markdown += `- \`${endpoint}\`\n`;
        });
      }
      markdown += `\n`;
      
      // Violations
      if (screen.violations.total > 0) {
        markdown += `**⚠️ Violations (${screen.violations.total}):**\n\n`;
        
        if (screen.violations.categorized.hardcodedColors.length > 0) {
          markdown += `**Hardcoded Colors:**\n`;
          screen.violations.categorized.hardcodedColors.slice(0, 10).forEach(v => {
            markdown += `- ❌ \`${v.value}\` - ${v.recommendation}\n`;
          });
          markdown += `\n`;
        }
        
        if (screen.violations.categorized.nonStandardSpacing.length > 0) {
          markdown += `**Non-Standard Spacing:**\n`;
          screen.violations.categorized.nonStandardSpacing.slice(0, 10).forEach(v => {
            markdown += `- ⚠️ \`${v.value}\` - ${v.recommendation}\n`;
          });
          markdown += `\n`;
        }
      } else {
        markdown += `**✅ No Violations Detected**\n\n`;
      }
      
      // Missing Items
      if (screen.missing && screen.missing.length > 0) {
        markdown += `**🧩 Missing Items:**\n`;
        screen.missing.forEach(item => {
          markdown += `- ${item}\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
  });
  
  // Add summary tables
  markdown += `## 📋 SUMMARY TABLES\n\n`;
  
  // Top Violations
  markdown += `### Top 10 Screens with Most Violations\n\n`;
  markdown += `| Screen | App | Violations | Match % |\n`;
  markdown += `|--------|-----|------------|----------|\n`;
  screens
    .sort((a, b) => b.violations.total - a.violations.total)
    .slice(0, 10)
    .forEach(screen => {
      markdown += `| ${screen.screenName} | ${screen.appType} | ${screen.violations.total} | ${screen.matchingPercentage}% |\n`;
    });
  
  markdown += `\n### Screens Missing API Integration\n\n`;
  markdown += `| Screen | App | Should Have API |\n`;
  markdown += `|--------|-----|-----------------|\n`;
  screens
    .filter(s => !s.hasAPIIntegration && (
      s.screenName.toLowerCase().includes('booking') ||
      s.screenName.toLowerCase().includes('service') ||
      s.screenName.toLowerCase().includes('vendor') ||
      s.screenName.toLowerCase().includes('dashboard')
    ))
    .slice(0, 20)
    .forEach(screen => {
      markdown += `| ${screen.screenName} | ${screen.appType} | ❌ Yes |\n`;
    });
  
  return markdown;
}

// Main execution
const analysisPath = path.join(process.cwd(), 'DESIGN_AUDIT_ANALYSIS.json');
const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

const markdown = generateMarkdownReport(data);

const reportPath = path.join(process.cwd(), 'PIXEL_PERFECT_DESIGN_COMPARISON_REPORT.md');
fs.writeFileSync(reportPath, markdown);

console.log(`✅ Generated comprehensive design comparison report!`);
console.log(`📄 Report saved to: ${reportPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total screens: ${data.summary.totalScreens}`);
console.log(`   - Total violations: ${data.summary.totalViolations}`);
console.log(`   - Report length: ${markdown.length} characters`);

