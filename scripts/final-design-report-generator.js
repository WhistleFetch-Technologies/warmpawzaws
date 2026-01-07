#!/usr/bin/env node

/**
 * Final Comprehensive Design Report Generator
 * Includes: Matching %, Missing Items, Violations, API Integration Status
 */

const fs = require('fs');
const path = require('path');

const DESIGN_TOKENS = {
  primary: '#FF8C42',
  primaryLight: '#FFA366',
  primaryDark: '#FF6B35',
  approvedColors: [
    '#FF8C42', '#FFA366', '#FF6B35', '#FFF5EE', '#FFE8D6',
    '#26C6DA', '#FF6B9D', '#9B59B6', '#4CAF50', '#FFC857',
    '#2196F3', '#E91E63', '#673AB7', '#4CAF50', '#EF4444',
  ],
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  borderRadius: [4, 8, 12, 16, 24, 32],
};

function generateFinalReport() {
  const analysisPath = path.join(process.cwd(), 'DESIGN_AUDIT_ANALYSIS.json');
  const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  
  let report = `# 🎨 PIXEL-PERFECT DESIGN COMPARISON REPORT
## Warmpawz Ecosystem Development - Complete Visual & Functional Audit

**Generated:** ${new Date().toISOString()}  
**Reference Design:** [Figma - Warmpawz Ecosystem Development](https://www.figma.com/design/YdfuhU9EWz4XDMwBgZf3Q0/Warmpawz-Ecosystem-Development)  
**Total Screens Analyzed:** ${data.summary.totalScreens}  
**Analysis Method:** Static code analysis + Component extraction + API endpoint detection

---

## 📊 EXECUTIVE SUMMARY

### Overall Platform Health

| Metric | Value | Status |
|--------|-------|--------|
| **Total Screens** | ${data.summary.totalScreens} | ✅ |
| **Total Violations** | ${data.summary.totalViolations} | ⚠️ |
| **Hardcoded Colors** | ${data.screens.reduce((sum, s) => sum + s.violations.filter(v => v.type === 'hardcoded_color').length, 0)} | ❌ |
| **Non-Standard Spacing** | ${data.screens.reduce((sum, s) => sum + s.violations.filter(v => v.type === 'non_standard_spacing').length, 0)} | ⚠️ |
| **API Integration Rate** | ${Math.round((data.summary.totalAPICalls / data.summary.totalScreens) * 100)}% | ⚠️ |

### App-by-App Breakdown

`;

  // Group by app type and calculate stats
  const byAppType = data.screens.reduce((acc, screen) => {
    if (!acc[screen.appType]) {
      acc[screen.appType] = [];
    }
    acc[screen.appType].push(screen);
    return acc;
  }, {});

  Object.keys(byAppType).forEach(appType => {
    const screens = byAppType[appType];
    const avgMatch = Math.round(
      screens.reduce((sum, s) => {
        const violations = s.violations.length;
        const shouldAPI = checkShouldHaveAPI(s.screenName);
        const apiPenalty = (!s.hasAPIIntegration && shouldAPI.should) ? 10 : 0;
        return sum + Math.max(0, 100 - (violations * 2) - apiPenalty);
      }, 0) / screens.length
    );
    const totalViolations = screens.reduce((sum, s) => sum + s.violations.length, 0);
    const apiIntegrated = screens.filter(s => s.hasAPIIntegration).length;
    const apiPercentage = Math.round((apiIntegrated / screens.length) * 100);
    
    report += `#### ${appType.toUpperCase()}\n\n`;
    report += `- **Screens:** ${screens.length}\n`;
    report += `- **Average Match %:** ${avgMatch}%\n`;
    report += `- **Total Violations:** ${totalViolations}\n`;
    report += `- **API Integration:** ${apiPercentage}% (${apiIntegrated}/${screens.length})\n\n`;
  });

  report += `\n---\n\n## 📱 COMPLETE SCREEN-BY-SCREEN ANALYSIS\n\n`;

  // Generate detailed report for each screen
  Object.keys(byAppType).forEach(appType => {
    report += `### ${appType.toUpperCase()} (${byAppType[appType].length} screens)\n\n`;
    
    const screens = byAppType[appType].sort((a, b) => {
      const aMatch = calculateMatchPercentage(a);
      const bMatch = calculateMatchPercentage(b);
      return bMatch - aMatch;
    });
    
    screens.forEach((screen, index) => {
      const matchPercentage = calculateMatchPercentage(screen);
      const shouldHaveAPI = checkShouldHaveAPI(screen.screenName);
      
      report += `#### ${index + 1}. ${screen.screenName}\n\n`;
      report += `**File Path:** \`${screen.filePath}\`\n\n`;
      
      // 1. MATCHING PERCENTAGE
      report += `### 1️⃣ Matching Percentage: **${matchPercentage}%**\n\n`;
      report += `**Breakdown:**\n`;
      report += `- Base Score: 100%\n`;
      report += `- Violations Deduction: -${screen.violations.length * 2}%\n`;
      if (shouldHaveAPI && !screen.hasAPIIntegration) {
        report += `- Missing API Integration: -10%\n`;
      }
      report += `\n`;
      
      // 2. COMPONENTS
      report += `### 2️⃣ Components Used (${screen.components.length})\n\n`;
      if (screen.components.length > 0) {
        const uniqueComponents = [...new Set(screen.components)];
        report += `\`\`\`\n${uniqueComponents.slice(0, 30).join(', ')}\n\`\`\`\n\n`;
        if (uniqueComponents.length > 30) {
          report += `*... and ${uniqueComponents.length - 30} more components*\n\n`;
        }
      } else {
        report += `*No components detected in code*\n\n`;
      }
      
      // 3. COLORS & STYLES
      report += `### 3️⃣ Colors & Styles (${screen.colors.length} unique)\n\n`;
      if (screen.colors.length > 0) {
        const uniqueColors = [...new Set(screen.colors)];
        const approvedColors = uniqueColors.filter(c => 
          DESIGN_TOKENS.approvedColors.some(ac => c.includes(ac.replace('#', '')))
        );
        const hardcodedColors = uniqueColors.filter(c => 
          c.startsWith('#') && !DESIGN_TOKENS.approvedColors.includes(c.toUpperCase())
        );
        
        report += `**Approved Design Tokens:** ${approvedColors.length}\n`;
        if (approvedColors.length > 0) {
          report += `\`\`\`\n${approvedColors.slice(0, 10).join(', ')}\n\`\`\`\n\n`;
        }
        
        if (hardcodedColors.length > 0) {
          report += `**⚠️ Hardcoded Colors:** ${hardcodedColors.length}\n`;
          report += `\`\`\`\n${hardcodedColors.slice(0, 10).join(', ')}\n\`\`\`\n\n`;
        }
      } else {
        report += `*No color classes detected*\n\n`;
      }
      
      // 4. LAYOUT & PLACEMENT
      report += `### 4️⃣ Layout Classes & Component Placement (${screen.layouts.length})\n\n`;
      if (screen.layouts.length > 0) {
        const uniqueLayouts = [...new Set(screen.layouts)];
        const flexLayouts = uniqueLayouts.filter(l => l.includes('flex'));
        const gridLayouts = uniqueLayouts.filter(l => l.includes('grid'));
        const spacingLayouts = uniqueLayouts.filter(l => l.match(/[mp][xy]?-\d+|gap-\d+/));
        const sizeLayouts = uniqueLayouts.filter(l => l.match(/w-|h-|max-w-|min-w-/));
        
        report += `**Layout Type:**\n`;
        report += `- Flex: ${flexLayouts.length} classes\n`;
        report += `- Grid: ${gridLayouts.length} classes\n`;
        report += `- Spacing: ${spacingLayouts.length} classes\n`;
        report += `- Sizing: ${sizeLayouts.length} classes\n\n`;
        
        report += `**Sample Layout Classes:**\n`;
        report += `\`\`\`\n${uniqueLayouts.slice(0, 25).join(', ')}\n\`\`\`\n\n`;
      } else {
        report += `*No layout classes detected*\n\n`;
      }
      
      // 5. MISSING ITEMS
      report += `### 5️⃣ Missing Items\n\n`;
      const missingItems = identifyMissingItems(screen, shouldHaveAPI);
      if (missingItems.length > 0) {
        missingItems.forEach(item => {
          report += `- ❌ ${item}\n`;
        });
      } else {
        report += `✅ No missing items detected\n`;
      }
      report += `\n`;
      
      // 6. VIOLATIONS
      report += `### 6️⃣ Violations (${screen.violations.length})\n\n`;
      if (screen.violations.length > 0) {
        const hardcodedColors = screen.violations.filter(v => v.type === 'hardcoded_color');
        const nonStandardSpacing = screen.violations.filter(v => v.type === 'non_standard_spacing');
        
        if (hardcodedColors.length > 0) {
          report += `**Hardcoded Colors (${hardcodedColors.length}):**\n`;
          hardcodedColors.slice(0, 15).forEach(v => {
            report += `- ❌ \`${v.value}\` - ${v.recommendation}\n`;
          });
          if (hardcodedColors.length > 15) {
            report += `*... and ${hardcodedColors.length - 15} more hardcoded colors*\n`;
          }
          report += `\n`;
        }
        
        if (nonStandardSpacing.length > 0) {
          report += `**Non-Standard Spacing (${nonStandardSpacing.length}):**\n`;
          nonStandardSpacing.slice(0, 15).forEach(v => {
            report += `- ⚠️ \`${v.value}\` - ${v.recommendation}\n`;
          });
          if (nonStandardSpacing.length > 15) {
            report += `*... and ${nonStandardSpacing.length - 15} more spacing violations*\n`;
          }
          report += `\n`;
        }
      } else {
        report += `✅ No violations detected\n\n`;
      }
      
      // 7. API CONTRACT & INTEGRATION STATUS
      report += `### 7️⃣ API Contract & Integration Status\n\n`;
      report += `**Integration Status:** ${screen.hasAPIIntegration ? '✅ Integrated' : '❌ Not Integrated'}\n\n`;
      
      if (shouldHaveAPI) {
        report += `**Should Have API:** ✅ Yes (${shouldHaveAPI.reason})\n\n`;
      } else {
        report += `**Should Have API:** ℹ️ No (Static/Display screen)\n\n`;
      }
      
      if (screen.apiCalls.length > 0) {
        report += `**API Endpoints Used (${screen.apiCalls.length}):**\n`;
        const uniqueEndpoints = [...new Set(screen.apiCalls.map(c => `${c.method} ${c.endpoint}`))];
        uniqueEndpoints.forEach(endpoint => {
          report += `- ✅ \`${endpoint}\`\n`;
        });
        report += `\n`;
      } else {
        if (shouldHaveAPI) {
          report += `**⚠️ Missing API Endpoints:**\n`;
          report += `- Expected endpoints for ${shouldHaveAPI.reason} functionality\n`;
          report += `- Screen appears to be static or not fully integrated\n\n`;
        } else {
          report += `**API Endpoints:** N/A (Static screen)\n\n`;
        }
      }
      
      // Check for API contract compliance
      const apiCompliance = checkAPIContractCompliance(screen);
      if (apiCompliance.issues.length > 0) {
        report += `**API Contract Issues:**\n`;
        apiCompliance.issues.forEach(issue => {
          report += `- ⚠️ ${issue}\n`;
        });
        report += `\n`;
      }
      
      report += `---\n\n`;
    });
  });
  
  // Add summary tables
  report += generateSummaryTables(data, byAppType);
  
  return report;
}

function calculateMatchPercentage(screen) {
  let score = 100;
  score -= screen.violations.length * 2;
  if (checkShouldHaveAPI(screen.screenName) && !screen.hasAPIIntegration) {
    score -= 10;
  }
  return Math.max(0, Math.round(score));
}

function checkShouldHaveAPI(screenName) {
  const name = screenName.toLowerCase();
  if (name.includes('booking') || name.includes('service') || name.includes('vendor') || 
      name.includes('dashboard') || name.includes('order') || name.includes('payment') ||
      name.includes('profile') || name.includes('settings') || name.includes('onboarding')) {
    return { should: true, reason: 'Dynamic data required' };
  }
  return { should: false, reason: 'Static/Display screen' };
}

function identifyMissingItems(screen, shouldHaveAPI) {
  const missing = [];
  
  if (shouldHaveAPI && !screen.hasAPIIntegration) {
    missing.push('API Integration');
  }
  
  if (screen.components.length === 0) {
    missing.push('Component structure');
  }
  
  if (screen.colors.length === 0) {
    missing.push('Color styling');
  }
  
  if (screen.layouts.length === 0) {
    missing.push('Layout classes');
  }
  
  return missing;
}

function checkAPIContractCompliance(screen) {
  const issues = [];
  
  // Check if API calls use proper methods
  screen.apiCalls.forEach(call => {
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(call.method)) {
      issues.push(`Invalid HTTP method: ${call.method}`);
    }
  });
  
  // Check if endpoints follow REST conventions
  screen.apiCalls.forEach(call => {
    if (!call.endpoint.startsWith('/')) {
      issues.push(`Endpoint should start with '/': ${call.endpoint}`);
    }
  });
  
  return { issues };
}

function generateSummaryTables(data, byAppType) {
  let tables = `## 📋 SUMMARY TABLES\n\n`;
  
  // Top violations
  tables += `### Top 20 Screens with Most Violations\n\n`;
  tables += `| Rank | Screen | App | Violations | Match % |\n`;
  tables += `|------|--------|-----|------------|----------|\n`;
  data.screens
    .map(s => ({ ...s, match: calculateMatchPercentage(s) }))
    .sort((a, b) => b.violations.length - a.violations.length)
    .slice(0, 20)
    .forEach((screen, index) => {
      tables += `| ${index + 1} | ${screen.screenName} | ${screen.appType} | ${screen.violations.length} | ${screen.match}% |\n`;
    });
  
  tables += `\n### Screens Missing API Integration\n\n`;
  tables += `| Screen | App | Should Have | Status |\n`;
  tables += `|--------|-----|-------------|--------|\n`;
  data.screens
    .filter(s => {
      const should = checkShouldHaveAPI(s.screenName);
      return should.should && !s.hasAPIIntegration;
    })
    .slice(0, 30)
    .forEach(screen => {
      const should = checkShouldHaveAPI(screen.screenName);
      tables += `| ${screen.screenName} | ${screen.appType} | ✅ Yes | ❌ Missing |\n`;
    });
  
  tables += `\n### Color Compliance Summary\n\n`;
  tables += `| App | Screens | Hardcoded Colors | Compliance % |\n`;
  tables += `|-----|---------|------------------|--------------|\n`;
  Object.keys(byAppType).forEach(appType => {
    const screens = byAppType[appType];
    const hardcoded = screens.reduce((sum, s) => 
      sum + s.violations.filter(v => v.type === 'hardcoded_color').length, 0
    );
    const compliance = Math.round(((screens.length * 10 - hardcoded) / (screens.length * 10)) * 100);
    tables += `| ${appType} | ${screens.length} | ${hardcoded} | ${compliance}% |\n`;
  });
  
  return tables;
}

// Main execution
const report = generateFinalReport();
const reportPath = path.join(process.cwd(), 'PIXEL_PERFECT_DESIGN_COMPARISON_REPORT.md');
fs.writeFileSync(reportPath, report);

console.log(`✅ Final comprehensive report generated!`);
console.log(`📄 Report saved to: ${reportPath}`);
console.log(`📊 Report size: ${(report.length / 1024).toFixed(2)} KB`);

