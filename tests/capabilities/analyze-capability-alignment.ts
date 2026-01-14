/**
 * Capability Alignment Analysis
 * Analyzes how capabilities align with roles and business objectives
 */

import { STANDARD_ROLE_DEFINITIONS } from '../../backend/lambda/src/endpoints/role-seeding';

interface CapabilityAnalysis {
  capability: string;
  roles: string[];
  businessObjective: string;
  features: string[];
  outcomes: string[];
  alignmentScore: number; // 0-100
  issues: string[];
}

interface RoleAnalysis {
  role: string;
  capabilities: string[];
  businessObjectives: string[];
  missingCapabilities: string[];
  unnecessaryCapabilities: string[];
  alignmentScore: number;
}

/**
 * Analyze capability-role alignment
 */
export function analyzeCapabilityRoleAlignment(): {
  capabilities: CapabilityAnalysis[];
  roles: RoleAnalysis[];
  overallScore: number;
} {
  const capabilityMap: Record<string, string[]> = {};
  const roleCapabilities: Record<string, string[]> = {};
  
  // Build capability-to-roles mapping
  for (const [roleName, roleDef] of Object.entries(STANDARD_ROLE_DEFINITIONS)) {
    roleCapabilities[roleName] = roleDef.capabilities || [];
    
    for (const capability of roleDef.capabilities || []) {
      if (!capabilityMap[capability]) {
        capabilityMap[capability] = [];
      }
      capabilityMap[capability].push(roleName);
    }
  }
  
  // Analyze each capability
  const capabilityAnalyses: CapabilityAnalysis[] = [];
  
  for (const [capability, roles] of Object.entries(capabilityMap)) {
    const analysis: CapabilityAnalysis = {
      capability,
      roles,
      businessObjective: getBusinessObjective(capability),
      features: getFeatures(capability),
      outcomes: getOutcomes(capability),
      alignmentScore: calculateCapabilityAlignmentScore(capability, roles),
      issues: identifyCapabilityIssues(capability, roles),
    };
    
    capabilityAnalyses.push(analysis);
  }
  
  // Analyze each role
  const roleAnalyses: RoleAnalysis[] = [];
  
  for (const [roleName, capabilities] of Object.entries(roleCapabilities)) {
    const roleDef = STANDARD_ROLE_DEFINITIONS[roleName];
    const analysis: RoleAnalysis = {
      role: roleName,
      capabilities,
      businessObjectives: getRoleBusinessObjectives(roleName, roleDef),
      missingCapabilities: identifyMissingCapabilities(roleName, roleDef),
      unnecessaryCapabilities: identifyUnnecessaryCapabilities(roleName, roleDef),
      alignmentScore: calculateRoleAlignmentScore(roleName, roleDef),
    };
    
    roleAnalyses.push(analysis);
  }
  
  // Calculate overall score
  const overallScore = 
    (capabilityAnalyses.reduce((sum, a) => sum + a.alignmentScore, 0) / capabilityAnalyses.length +
     roleAnalyses.reduce((sum, r) => sum + r.alignmentScore, 0) / roleAnalyses.length) / 2;
  
  return {
    capabilities: capabilityAnalyses,
    roles: roleAnalyses,
    overallScore,
  };
}

/**
 * Get business objective for a capability
 */
function getBusinessObjective(capability: string): string {
  const objectives: Record<string, string> = {
    'dashboard': 'Provide central hub for vendor operations and quick access to key metrics',
    'bookings': 'Enable appointment management and customer scheduling',
    'services': 'Manage service catalog and offerings',
    'staff': 'Manage team members and assign roles (business vendors only)',
    'schedule': 'Manage availability and working hours',
    'profile': 'Update business information and contact details',
    'earnings': 'Track revenue and financial performance',
    'settlements': 'Monitor payouts and payment status',
    'bank_account': 'Manage bank details for payouts',
    'pricing': 'Configure service pricing and discounts',
    'chat': 'Enable customer communication',
    'notifications': 'Send alerts and manage notifications',
    'video_calling': 'Enable video consultations',
    'prescriptions': 'Create and manage prescriptions (healthcare)',
    'medical_records': 'Manage patient medical records (healthcare)',
    'diagnostics': 'Manage diagnostic tests and results (healthcare)',
    'pharmacy': 'Manage medicine inventory and orders (pharmacy)',
    'ambulance': 'Manage ambulance fleet and emergency services',
    'cafe_tables': 'Manage cafe table configuration and reservations',
    'rooms': 'Manage resort/boarding rooms',
    'insurance_plans': 'Manage insurance plans and policies',
    'pet_profiles': 'Create pet listings for adoption/breeding',
    'meal_plans': 'Create meal plans and diet charts (nutritionist)',
    'training_programs': 'Manage training programs and sessions',
    'walking': 'Manage walking services and routes',
    'inventory': 'Track stock levels and manage inventory',
    'orders': 'Process orders and track fulfillment',
    'delivery': 'Track deliveries and manage shipping',
    'gps_tracking': 'Track live locations and routes',
    'reports': 'Generate business reports and analytics',
    'settings': 'Configure system settings and preferences',
    'packages': 'Create service packages and bundles',
    'subscriptions': 'Manage recurring subscriptions',
    'coupons': 'Create and manage discount coupons',
    'promotions': 'Create marketing campaigns',
    'reviews': 'Manage customer reviews and ratings',
    'analytics': 'View business analytics and insights',
    'export': 'Export data in various formats',
    'integrations': 'Connect third-party services',
  };
  
  return objectives[capability] || `Enable ${capability.replace(/_/g, ' ')} functionality`;
}

/**
 * Get features for a capability
 */
function getFeatures(capability: string): string[] {
  // This would be populated from the detailed capability analysis
  return [`Feature 1 for ${capability}`, `Feature 2 for ${capability}`];
}

/**
 * Get outcomes for a capability
 */
function getOutcomes(capability: string): string[] {
  // This would be populated from the detailed capability analysis
  return [`Outcome 1 for ${capability}`, `Outcome 2 for ${capability}`];
}

/**
 * Calculate alignment score for a capability
 */
function calculateCapabilityAlignmentScore(capability: string, roles: string[]): number {
  let score = 100;
  
  // Check if capability is assigned to appropriate roles
  // This is a simplified scoring - would need business logic for accurate scoring
  
  // Example: prescriptions should only be for healthcare roles
  if (capability === 'prescriptions') {
    const healthcareRoles = ['veterinarian', 'veterinary_clinic', 'pet_pharmacy', 'nutritionist'];
    const hasNonHealthcare = roles.some(r => !healthcareRoles.includes(r));
    if (hasNonHealthcare) {
      score -= 20;
    }
  }
  
  // Example: ambulance should only be for ambulance/clinic roles
  if (capability === 'ambulance' || capability === 'ambulance_services') {
    const ambulanceRoles = ['pet_ambulance', 'veterinary_clinic'];
    const hasNonAmbulance = roles.some(r => !ambulanceRoles.includes(r));
    if (hasNonAmbulance) {
      score -= 20;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Identify issues with capability assignment
 */
function identifyCapabilityIssues(capability: string, roles: string[]): string[] {
  const issues: string[] = [];
  
  // Add business logic to identify issues
  // Example: prescriptions assigned to non-healthcare roles
  
  return issues;
}

/**
 * Get business objectives for a role
 */
function getRoleBusinessObjectives(roleName: string, roleDef: any): string[] {
  const objectives: string[] = [];
  
  // Add role-specific business objectives
  if (roleDef.category === 'healthcare') {
    objectives.push('Provide healthcare services to pets');
    objectives.push('Manage patient records and prescriptions');
  }
  
  if (roleDef.category === 'service_provider') {
    objectives.push('Provide services to pet owners');
    objectives.push('Manage bookings and schedules');
  }
  
  if (roleDef.category === 'retail') {
    objectives.push('Sell products to customers');
    objectives.push('Manage inventory and orders');
  }
  
  return objectives;
}

/**
 * Identify missing capabilities for a role
 */
function identifyMissingCapabilities(roleName: string, roleDef: any): string[] {
  const missing: string[] = [];
  
  // Add logic to identify missing capabilities based on role type
  // Example: service providers should have 'bookings' capability
  
  return missing;
}

/**
 * Identify unnecessary capabilities for a role
 */
function identifyUnnecessaryCapabilities(roleName: string, roleDef: any): string[] {
  const unnecessary: string[] = [];
  
  // Add logic to identify unnecessary capabilities
  // Example: non-healthcare roles shouldn't have 'prescriptions'
  
  return unnecessary;
}

/**
 * Calculate alignment score for a role
 */
function calculateRoleAlignmentScore(roleName: string, roleDef: any): number {
  let score = 100;
  
  // Deduct points for missing capabilities
  const missing = identifyMissingCapabilities(roleName, roleDef);
  score -= missing.length * 5;
  
  // Deduct points for unnecessary capabilities
  const unnecessary = identifyUnnecessaryCapabilities(roleName, roleDef);
  score -= unnecessary.length * 10;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate analysis report
 */
export function generateAnalysisReport(analysis: {
  capabilities: CapabilityAnalysis[];
  roles: RoleAnalysis[];
  overallScore: number;
}): string {
  let report = '# Capability-Role Alignment Analysis Report\n\n';
  report += `**Date:** ${new Date().toISOString()}\n\n`;
  
  report += `## Overall Alignment Score: ${analysis.overallScore.toFixed(2)}/100\n\n`;
  
  report += `## Capability Analysis\n\n`;
  
  // Sort capabilities by alignment score
  const sortedCapabilities = [...analysis.capabilities].sort((a, b) => 
    a.alignmentScore - b.alignmentScore
  );
  
  for (const cap of sortedCapabilities) {
    report += `### ${cap.capability}\n`;
    report += `- **Alignment Score:** ${cap.alignmentScore}/100\n`;
    report += `- **Assigned to Roles:** ${cap.roles.join(', ')}\n`;
    report += `- **Business Objective:** ${cap.businessObjective}\n`;
    
    if (cap.issues.length > 0) {
      report += `- **Issues:**\n`;
      for (const issue of cap.issues) {
        report += `  - ⚠️ ${issue}\n`;
      }
    }
    
    report += `\n`;
  }
  
  report += `## Role Analysis\n\n`;
  
  // Sort roles by alignment score
  const sortedRoles = [...analysis.roles].sort((a, b) => 
    a.alignmentScore - b.alignmentScore
  );
  
  for (const role of sortedRoles) {
    report += `### ${role.role}\n`;
    report += `- **Alignment Score:** ${role.alignmentScore}/100\n`;
    report += `- **Capabilities:** ${role.capabilities.length}\n`;
    report += `- **Business Objectives:** ${role.businessObjectives.join(', ')}\n`;
    
    if (role.missingCapabilities.length > 0) {
      report += `- **Missing Capabilities:** ${role.missingCapabilities.join(', ')}\n`;
    }
    
    if (role.unnecessaryCapabilities.length > 0) {
      report += `- **Unnecessary Capabilities:** ${role.unnecessaryCapabilities.join(', ')}\n`;
    }
    
    report += `\n`;
  }
  
  return report;
}

export default {
  analyzeCapabilityRoleAlignment,
  generateAnalysisReport,
};
