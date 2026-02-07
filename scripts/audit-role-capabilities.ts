/**
 * ============================================================================
 * ROLE CAPABILITY AUDIT SCRIPT
 * ============================================================================
 * 
 * Comprehensive audit of role configurations and capability implementations:
 * 1. Checks database role configurations vs UI configurations
 * 2. Identifies over-capabilities (more than defined)
 * 3. Identifies under-capabilities (less than defined)
 * 4. Verifies complete lifecycle implementation:
 *    - UI components
 *    - API contracts
 *    - Handlers
 *    - Functional models
 *    - Data handoff
 *    - Wireframe implementation
 * 
 * Usage: npx tsx scripts/audit-role-capabilities.ts
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

interface CapabilityLifecycle {
  capability: string;
  ui: boolean;
  apiContract: boolean;
  handler: boolean;
  functionalModel: boolean;
  dataHandoff: boolean;
  wireframe: boolean;
}

interface RoleAudit {
  roleId: string;
  roleName: string;
  dbCapabilities: string[];
  uiCapabilities: string[];
  dashboardSections: string[];
  overCapabilities: string[];
  underCapabilities: string[];
  lifecycle: CapabilityLifecycle[];
  completeness: number; // 0-100%
}

interface AuditReport {
  timestamp: string;
  roles: RoleAudit[];
  summary: {
    totalRoles: number;
    rolesWithIssues: number;
    totalCapabilities: number;
    averageCompleteness: number;
    criticalIssues: string[];
  };
}

// Read role-config.ts to extract UI capabilities
function extractUICapabilities(): Map<string, { capabilities: string[], sections: string[] }> {
  const roleConfigPath = path.join(__dirname, '../apps/vendor-web/lib/role-config.ts');
  const content = fs.readFileSync(roleConfigPath, 'utf-8');
  
  const roleMap = new Map<string, { capabilities: string[], sections: string[] }>();
  
  // Extract ROLE_CONFIGS
  const roleConfigMatch = content.match(/export const ROLE_CONFIGS[^=]*=\s*\{([\s\S]*?)\};/);
  if (!roleConfigMatch) {
    console.warn('Could not find ROLE_CONFIGS in role-config.ts');
    return roleMap;
  }
  
  const roleConfigsContent = roleConfigMatch[1];
  
  // Extract each role configuration
  const rolePattern = /(\w+):\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = rolePattern.exec(roleConfigsContent)) !== null) {
    const roleName = match[1];
    const roleContent = match[2];
    
    // Extract dashboard sections
    const sections: string[] = [];
    const sectionPattern = /id:\s*['"]([^'"]+)['"]/g;
    let sectionMatch;
    while ((sectionMatch = sectionPattern.exec(roleContent)) !== null) {
      sections.push(sectionMatch[1]);
    }
    
    // Extract requiresCapability from sections
    const capabilities: string[] = [];
    const capabilityPattern = /requiresCapability:\s*['"]([^'"]+)['"]/g;
    let capMatch;
    while ((capMatch = capabilityPattern.exec(roleContent)) !== null) {
      capabilities.push(capMatch[1]);
    }
    
    roleMap.set(roleName, { capabilities, sections });
  }
  
  return roleMap;
}

// Read capability-routes.ts to get all defined capabilities
function extractAllCapabilities(): Set<string> {
  const capabilityRoutesPath = path.join(__dirname, '../apps/vendor-web/lib/capability-routes.ts');
  const content = fs.readFileSync(capabilityRoutesPath, 'utf-8');
  
  const capabilities = new Set<string>();
  
  // Extract capability names from CAPABILITY_ROUTES
  const routePattern = /(\w+):\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = routePattern.exec(content)) !== null) {
    const capabilityName = match[2];
    capabilities.add(capabilityName);
  }
  
  return capabilities;
}

// Check UI implementation
function checkUIImplementation(capability: string): boolean {
  const vendorDashboardPath = path.join(__dirname, '../apps/vendor-web/components/vendor/VendorDashboard.tsx');
  const content = fs.readFileSync(vendorDashboardPath, 'utf-8');
  
  // Check if capability is referenced in VendorDashboard
  const capabilityPatterns = [
    new RegExp(`hasCapability\\(['"]${capability}['"]\\)`, 'i'),
    new RegExp(`capabilities\\.${capability}`, 'i'),
    new RegExp(`capabilities\\[['"]${capability}['"]\\]`, 'i'),
    new RegExp(`CapabilityGate.*${capability}`, 'i'),
    new RegExp(`requiresCapability.*${capability}`, 'i'),
  ];
  
  return capabilityPatterns.some(pattern => pattern.test(content));
}

// Check API contract
function checkAPIContract(capability: string): boolean {
  const apiPaths = [
    '../backend/lambda/src/endpoints/vendor-dashboard.ts',
    '../backend/lambda/src/endpoints/roles.ts',
    '../backend/lambda/src/middleware/capability-enforcement.ts',
  ];
  
  for (const apiPath of apiPaths) {
    const fullPath = path.join(__dirname, apiPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes(capability)) {
        return true;
      }
    }
  }
  
  return false;
}

// Check handler implementation
function checkHandler(capability: string): boolean {
  const handlerPaths = [
    '../backend/lambda/src/handler',
    '../backend/lambda/src/endpoints',
  ];
  
  for (const handlerPath of handlerPaths) {
    const fullPath = path.join(__dirname, handlerPath);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      for (const file of files) {
        if (file.toString().endsWith('.ts')) {
          const filePath = path.join(fullPath, file.toString());
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.includes(capability)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Check functional model
function checkFunctionalModel(capability: string): boolean {
  const modelPaths = [
    '../backend/lambda/src/models',
    '../backend/lambda/src/types',
  ];
  
  for (const modelPath of modelPaths) {
    const fullPath = path.join(__dirname, modelPath);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      for (const file of files) {
        if (file.toString().endsWith('.ts')) {
          const filePath = path.join(fullPath, file.toString());
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.includes(capability)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Check data handoff (database migrations, schemas)
function checkDataHandoff(capability: string): boolean {
  const dbPaths = [
    '../db/migrations',
    '../database/migrations',
  ];
  
  for (const dbPath of dbPaths) {
    const fullPath = path.join(__dirname, dbPath);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      for (const file of files) {
        if (file.toString().endsWith('.sql')) {
          const filePath = path.join(fullPath, file.toString());
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.includes(capability)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Check wireframe implementation (UI components)
function checkWireframe(capability: string): boolean {
  const uiPaths = [
    '../apps/vendor-web/components/vendor',
    '../apps/vendor-web/app',
  ];
  
  for (const uiPath of uiPaths) {
    const fullPath = path.join(__dirname, uiPath);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      for (const file of files) {
        if (file.toString().endsWith('.tsx') || file.toString().endsWith('.ts')) {
          const filePath = path.join(fullPath, file.toString());
          const content = fs.readFileSync(filePath, 'utf-8');
          // Check for component names or routes related to capability
          const capabilityLower = capability.toLowerCase().replace(/_/g, '');
          if (content.toLowerCase().includes(capabilityLower)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Read database role configurations from migration files
function extractDBCapabilities(): Map<string, string[]> {
  const roleMap = new Map<string, string[]>();
  
  // Read from seed_role_permissions.sql
  const permissionsPath = path.join(__dirname, '../db/migrations/051_seed_role_permissions.sql');
  if (fs.existsSync(permissionsPath)) {
    const content = fs.readFileSync(permissionsPath, 'utf-8');
    
    // Extract role permissions
    const rolePattern = /--\s*(\d+)\.\s*(\w+)[\s\S]*?SELECT insert_role_permissions\(['"](\w+)['"],\s*ARRAY\[([\s\S]*?)\]\);/g;
    let match;
    
    while ((match = rolePattern.exec(content)) !== null) {
      const roleName = match[3];
      const permissionsStr = match[4];
      
      // Extract permission names
      const permissions: string[] = [];
      const permPattern = /['"]([^'"]+)['"]/g;
      let permMatch;
      while ((permMatch = permPattern.exec(permissionsStr)) !== null) {
        permissions.push(permMatch[1]);
      }
      
      roleMap.set(roleName, permissions);
    }
  }
  
  // Also read from seed_roles.sql for capabilities in config
  const rolesPath = path.join(__dirname, '../db/migrations/047_seed_roles.sql');
  if (fs.existsSync(rolesPath)) {
    const content = fs.readFileSync(rolesPath, 'utf-8');
    
    // Extract capabilities from config JSON
    const configPattern = /['"]capabilities['"]:\s*\[([^\]]+)\]/g;
    const roleNamePattern = /\(['"](\w+)['"]/g;
    
    let roleMatch;
    let lastRoleName = '';
    while ((roleMatch = roleNamePattern.exec(content)) !== null) {
      lastRoleName = roleMatch[1];
    }
    
    let configMatch;
    while ((configMatch = configPattern.exec(content)) !== null) {
      const capabilitiesStr = configMatch[1];
      const capabilities: string[] = [];
      const capPattern = /['"]([^'"]+)['"]/g;
      let capMatch;
      while ((capMatch = capPattern.exec(capabilitiesStr)) !== null) {
        capabilities.push(capMatch[1]);
      }
      
      if (lastRoleName && capabilities.length > 0) {
        const existing = roleMap.get(lastRoleName) || [];
        roleMap.set(lastRoleName, [...new Set([...existing, ...capabilities])]);
      }
    }
  }
  
  return roleMap;
}

// Main audit function
async function auditRoleCapabilities(): Promise<AuditReport> {
  console.log('🔍 Starting Role Capability Audit...\n');
  
  // Extract data
  console.log('📖 Extracting role configurations...');
  const dbCapabilities = extractDBCapabilities();
  const uiCapabilities = extractUICapabilities();
  const allCapabilities = extractAllCapabilities();
  
  console.log(`   Found ${dbCapabilities.size} roles in database`);
  console.log(`   Found ${uiCapabilities.size} roles in UI config`);
  console.log(`   Found ${allCapabilities.size} total capabilities\n`);
  
  // Audit each role
  const roleAudits: RoleAudit[] = [];
  const allRoleNames = new Set([...dbCapabilities.keys(), ...uiCapabilities.keys()]);
  
  for (const roleName of allRoleNames) {
    console.log(`🔎 Auditing role: ${roleName}`);
    
    const dbCaps = dbCapabilities.get(roleName) || [];
    const uiData = uiCapabilities.get(roleName) || { capabilities: [], sections: [] };
    const uiCaps = uiData.capabilities;
    
    // Find over-capabilities (in UI but not in DB)
    const overCapabilities = uiCaps.filter(cap => !dbCaps.includes(cap));
    
    // Find under-capabilities (in DB but not in UI)
    const underCapabilities = dbCaps.filter(cap => !uiCaps.includes(cap));
    
    // Check lifecycle for all capabilities
    const allCapsForRole = [...new Set([...dbCaps, ...uiCaps])];
    const lifecycle: CapabilityLifecycle[] = allCapsForRole.map(cap => ({
      capability: cap,
      ui: checkUIImplementation(cap),
      apiContract: checkAPIContract(cap),
      handler: checkHandler(cap),
      functionalModel: checkFunctionalModel(cap),
      dataHandoff: checkDataHandoff(cap),
      wireframe: checkWireframe(cap),
    }));
    
    // Calculate completeness
    const totalChecks = lifecycle.length * 6; // 6 lifecycle stages
    const passedChecks = lifecycle.reduce((sum, lc) => {
      return sum + (lc.ui ? 1 : 0) + (lc.apiContract ? 1 : 0) + 
             (lc.handler ? 1 : 0) + (lc.functionalModel ? 1 : 0) + 
             (lc.dataHandoff ? 1 : 0) + (lc.wireframe ? 1 : 0);
    }, 0);
    const completeness = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    roleAudits.push({
      roleId: roleName,
      roleName: roleName,
      dbCapabilities: dbCaps,
      uiCapabilities: uiCaps,
      dashboardSections: uiData.sections,
      overCapabilities,
      underCapabilities,
      lifecycle,
      completeness,
    });
    
    console.log(`   ✅ Complete (${completeness}%)\n`);
  }
  
  // Generate summary
  const rolesWithIssues = roleAudits.filter(r => 
    r.overCapabilities.length > 0 || r.underCapabilities.length > 0 || r.completeness < 100
  ).length;
  
  const totalCapabilities = roleAudits.reduce((sum, r) => sum + r.dbCapabilities.length, 0);
  const averageCompleteness = Math.round(
    roleAudits.reduce((sum, r) => sum + r.completeness, 0) / roleAudits.length
  );
  
  const criticalIssues: string[] = [];
  roleAudits.forEach(role => {
    if (role.overCapabilities.length > 0) {
      criticalIssues.push(`${role.roleName}: ${role.overCapabilities.length} over-capabilities`);
    }
    if (role.underCapabilities.length > 0) {
      criticalIssues.push(`${role.roleName}: ${role.underCapabilities.length} under-capabilities`);
    }
    if (role.completeness < 50) {
      criticalIssues.push(`${role.roleName}: Only ${role.completeness}% lifecycle complete`);
    }
  });
  
  return {
    timestamp: new Date().toISOString(),
    roles: roleAudits,
    summary: {
      totalRoles: roleAudits.length,
      rolesWithIssues,
      totalCapabilities,
      averageCompleteness,
      criticalIssues,
    },
  };
}

// Generate markdown report
function generateMarkdownReport(report: AuditReport): string {
  let md = `# Role Capability Audit Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;
  md += `## Executive Summary\n\n`;
  md += `- **Total Roles:** ${report.summary.totalRoles}\n`;
  md += `- **Roles with Issues:** ${report.summary.rolesWithIssues}\n`;
  md += `- **Total Capabilities:** ${report.summary.totalCapabilities}\n`;
  md += `- **Average Completeness:** ${report.summary.averageCompleteness}%\n\n`;
  
  if (report.summary.criticalIssues.length > 0) {
    md += `### ⚠️ Critical Issues\n\n`;
    report.summary.criticalIssues.forEach(issue => {
      md += `- ${issue}\n`;
    });
    md += `\n`;
  }
  
  md += `## Detailed Role Analysis\n\n`;
  
  report.roles.forEach(role => {
    md += `### ${role.roleName}\n\n`;
    md += `**Completeness:** ${role.completeness}%\n\n`;
    
    md += `#### Database Capabilities (${role.dbCapabilities.length})\n`;
    role.dbCapabilities.forEach(cap => {
      md += `- ${cap}\n`;
    });
    md += `\n`;
    
    md += `#### UI Capabilities (${role.uiCapabilities.length})\n`;
    role.uiCapabilities.forEach(cap => {
      md += `- ${cap}\n`;
    });
    md += `\n`;
    
    if (role.overCapabilities.length > 0) {
      md += `#### ⚠️ Over-Capabilities (${role.overCapabilities.length})\n`;
      role.overCapabilities.forEach(cap => {
        md += `- ${cap} (in UI but not in DB)\n`;
      });
      md += `\n`;
    }
    
    if (role.underCapabilities.length > 0) {
      md += `#### ⚠️ Under-Capabilities (${role.underCapabilities.length})\n`;
      role.underCapabilities.forEach(cap => {
        md += `- ${cap} (in DB but not in UI)\n`;
      });
      md += `\n`;
    }
    
    md += `#### Lifecycle Implementation\n\n`;
    md += `| Capability | UI | API | Handler | Model | Data | Wireframe |\n`;
    md += `|------------|----|-----|---------|-------|------|----------|\n`;
    role.lifecycle.forEach(lc => {
      md += `| ${lc.capability} | ${lc.ui ? '✅' : '❌'} | ${lc.apiContract ? '✅' : '❌'} | ${lc.handler ? '✅' : '❌'} | ${lc.functionalModel ? '✅' : '❌'} | ${lc.dataHandoff ? '✅' : '❌'} | ${lc.wireframe ? '✅' : '❌'} |\n`;
    });
    md += `\n`;
  });
  
  md += `## Fixing Plan\n\n`;
  md += `### Phase 1: Align Database and UI Capabilities\n\n`;
  md += `1. For each role with over-capabilities:\n`;
  md += `   - Remove UI capabilities not in database, OR\n`;
  md += `   - Add missing capabilities to database\n\n`;
  md += `2. For each role with under-capabilities:\n`;
  md += `   - Add UI capabilities matching database, OR\n`;
  md += `   - Remove capabilities from database if not needed\n\n`;
  
  md += `### Phase 2: Complete Lifecycle Implementation\n\n`;
  md += `1. For capabilities missing UI:\n`;
  md += `   - Create UI components in VendorDashboard\n`;
  md += `   - Add navigation handlers\n`;
  md += `   - Add capability gates\n\n`;
  md += `2. For capabilities missing API contracts:\n`;
  md += `   - Add endpoints in backend/lambda/src/endpoints\n`;
  md += `   - Add capability enforcement middleware\n\n`;
  md += `3. For capabilities missing handlers:\n`;
  md += `   - Create handler classes in backend/lambda/src/handler\n`;
  md += `   - Implement business logic\n\n`;
  md += `4. For capabilities missing functional models:\n`;
  md += `   - Create data models in backend/lambda/src/models\n`;
  md += `   - Add type definitions\n\n`;
  md += `5. For capabilities missing data handoff:\n`;
  md += `   - Create database migrations\n`;
  md += `   - Add schema definitions\n\n`;
  md += `6. For capabilities missing wireframes:\n`;
  md += `   - Create UI components\n`;
  md += `   - Implement wireframe designs\n\n`;
  
  return md;
}

// Main execution
async function main() {
  try {
    const report = await auditRoleCapabilities();
    
    // Save JSON report
    const jsonPath = path.join(__dirname, '../ROLE_CAPABILITY_AUDIT_REPORT.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved to: ${jsonPath}`);
    
    // Save Markdown report
    const mdReport = generateMarkdownReport(report);
    const mdPath = path.join(__dirname, '../ROLE_CAPABILITY_AUDIT_REPORT.md');
    fs.writeFileSync(mdPath, mdReport);
    console.log(`✅ Markdown report saved to: ${mdPath}`);
    
    // Print summary
    console.log('\n📊 Audit Summary:');
    console.log(`   Total Roles: ${report.summary.totalRoles}`);
    console.log(`   Roles with Issues: ${report.summary.rolesWithIssues}`);
    console.log(`   Average Completeness: ${report.summary.averageCompleteness}%`);
    
    if (report.summary.criticalIssues.length > 0) {
      console.log('\n⚠️  Critical Issues:');
      report.summary.criticalIssues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { auditRoleCapabilities, generateMarkdownReport };
