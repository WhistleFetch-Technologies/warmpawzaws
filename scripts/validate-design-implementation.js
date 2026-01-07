#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DESIGN_TOKENS = {
  primary: '#FF8C42',
  primaryLight: '#FFA366',
  primaryDark: '#FF6B35',
  approved: ['#FF8C42', '#FFA366', '#FF6B35', '#FFF5EE', '#FFE8D6', '#26C6DA', '#FF6B9D', '#9B59B6', '#4CAF50', '#FFC857', '#2196F3', '#E91E63', '#673AB7', '#000000', '#FFFFFF']
};

function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    const hardcodedColors = [];
    const colorMatches = content.matchAll(/#[0-9A-Fa-f]{6}/g);
    for (const match of colorMatches) {
      const color = match[0].toUpperCase();
      if (!DESIGN_TOKENS.approved.includes(color)) {
        hardcodedColors.push(color);
      }
    }
    
    const hasAPIClient = content.includes('apiClient') || content.includes('fetch(') || content.includes('axios');
    const hasUseEffect = content.includes('useEffect');
    const hasAPIInEffect = hasUseEffect && hasAPIClient;
    
    const usesDesignTokens = content.includes('colors.') || content.includes('from') && content.includes('colors') || content.includes('bg-primary') || content.includes('text-primary');
    
    return {
      file: relativePath,
      hardcodedColors: [...new Set(hardcodedColors)],
      hasAPIIntegration: hasAPIInEffect,
      usesDesignTokens,
      violationCount: hardcodedColors.length
    };
  } catch (error) {
    return null;
  }
}

const screens = [
  'apps/customer-web/components/customer/CustomerHomeComplete.tsx',
  'apps/customer-web/components/customer/BookingFlow.tsx',
  'apps/customer-web/components/customer/CustomerWallet.tsx',
  'apps/vendor-web/components/vendor/VendorDashboard.tsx',
  'apps/WarmpawzCustomer/src/screens/appointments/AppointmentDetailScreen.tsx',
  'apps/WarmpawzCustomer/src/screens/appointments/AppointmentListScreen.tsx',
  'apps/WarmpawzVendor/src/screens/dashboard/VendorDashboardScreen.tsx',
];

console.log('=== DESIGN IMPLEMENTATION VALIDATION ===\n');

screens.forEach(screen => {
  const fullPath = path.join(process.cwd(), screen);
  if (fs.existsSync(fullPath)) {
    const result = validateFile(fullPath);
    if (result) {
      console.log(`File: ${result.file}`);
      console.log(`  Hardcoded Colors: ${result.hardcodedColors.length > 0 ? '❌ ' + result.hardcodedColors.join(', ') : '✅ None'}`);
      console.log(`  Uses Design Tokens: ${result.usesDesignTokens ? '✅ Yes' : '❌ No'}`);
      console.log(`  API Integration: ${result.hasAPIIntegration ? '✅ Yes' : '❌ No'}`);
      console.log(`  Violations: ${result.violationCount}`);
      console.log('');
    }
  }
});
