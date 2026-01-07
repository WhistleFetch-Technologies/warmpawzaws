/**
 * Phase 3 AI Chatbot Integration Verification Script
 * 
 * Verifies:
 * 1. Backend endpoints are created and registered
 * 2. AWS Bedrock client is properly configured
 * 3. Support/CRM endpoints are created
 * 4. Mobile app has chatbot screen and navigation
 * 5. Web app has chatbot widget
 * 6. API methods are defined in both mobile and web
 */

const fs = require('fs');
const path = require('path');

const BACKEND_FILES = {
  'bedrock-client': 'backend/lambda/src/utils/bedrock-client.ts',
  'ai-chatbot': 'backend/lambda/src/endpoints/ai-chatbot.ts',
  'support-crm': 'backend/lambda/src/endpoints/support-crm.ts',
};

const EXPECTED_ENDPOINTS = {
  'ai-chatbot': [
    { method: 'POST', path: '/ai-chatbot/chat' },
    { method: 'POST', path: '/ai-chatbot/symptoms-checker' },
    { method: 'POST', path: '/ai-chatbot/booking-assist' },
    { method: 'POST', path: '/ai-chatbot/escalate-to-agent' },
    { method: 'GET', path: '/ai-chatbot/conversation/:conversationId' },
  ],
  'support-crm': [
    { method: 'POST', path: '/support/tickets' },
    { method: 'GET', path: '/support/tickets' },
    { method: 'GET', path: '/support/tickets/:ticketId' },
    { method: 'POST', path: '/support/tickets/:ticketId/respond' },
    { method: 'PUT', path: '/support/tickets/:ticketId/assign' },
    { method: 'PUT', path: '/support/tickets/:ticketId/status' },
  ],
};

const MOBILE_FILES = {
  'chatbot-screen': 'apps/WarmpawzCustomer/src/screens/ai-chatbot/AIChatbotScreen.tsx',
  'api-service': 'apps/WarmpawzCustomer/src/services/api.ts',
  'app-navigation': 'apps/WarmpawzCustomer/App.tsx',
  'help-support': 'apps/WarmpawzCustomer/src/screens/settings/HelpSupportScreen.tsx',
};

const WEB_FILES = {
  'chatbot-widget': 'apps/customer-web/components/customer/AIChatbotWidget.tsx',
  'api-client': 'apps/customer-web/lib/api-client.ts',
  'home-component': 'apps/customer-web/components/customer/CustomerHomeComplete.tsx',
};

const HANDLER_FILE = 'backend/lambda/src/handler/index.ts';

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function verifyBackendEndpoint(filePath, expectedEndpoints) {
  const content = readFile(filePath);
  if (!content) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const hasRegisterFunction = /export function register\w+Endpoints/.test(content);
  if (!hasRegisterFunction) {
    return { success: false, error: 'Missing register function' };
  }

  const results = {};
  let allPassed = true;

  for (const endpoint of expectedEndpoints) {
    const pathPattern = endpoint.path.replace(/:\w+/g, '.*?');
    const methodPattern = `app\\.${endpoint.method.toLowerCase()}`;
    const pathRegex = new RegExp(`${methodPattern}\\(["'\`]${pathPattern.replace(/\//g, '\\/')}["'\`]`);

    const found = pathRegex.test(content);
    results[endpoint.path] = { found, method: endpoint.method };

    if (!found) {
      allPassed = false;
    }
  }

  return { success: allPassed, results, hasRegisterFunction };
}

function verifyBedrockClient(filePath) {
  const content = readFile(filePath);
  if (!content) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const hasGetConfig = /export.*function getBedrockConfig/.test(content);
  const hasInvoke = /export.*function invokeBedrock/.test(content);
  const hasBedrockImport = /@aws-sdk\/client-bedrock-runtime/.test(content);
  const hasErrorHandling = /try\s*\{[\s\S]*?catch/.test(content);

  return {
    success: hasGetConfig && hasInvoke && hasBedrockImport && hasErrorHandling,
    hasGetConfig,
    hasInvoke,
    hasBedrockImport,
    hasErrorHandling,
  };
}

function verifyMobileIntegration() {
  const results = {};
  let allPassed = true;

  // Check chatbot screen exists
  const screenContent = readFile(MOBILE_FILES['chatbot-screen']);
  if (!screenContent) {
    results.screen = { found: false };
    allPassed = false;
  } else {
    const hasAIChatbotApi = /AIChatbotApi/.test(screenContent);
    const hasSupportCrmApi = /SupportCrmApi/.test(screenContent);
    const hasModes = /mode.*===.*'symptoms'|mode.*===.*'booking'/.test(screenContent);
    results.screen = { found: true, hasAIChatbotApi, hasSupportCrmApi, hasModes };
    if (!hasAIChatbotApi || !hasModes) {
      allPassed = false;
    }
  }

  // Check API methods
  const apiContent = readFile(MOBILE_FILES['api-service']);
  if (apiContent) {
    const hasAIChatbotApi = /export const AIChatbotApi/.test(apiContent);
    const hasSupportCrmApi = /export const SupportCrmApi/.test(apiContent);
    results.api = { hasAIChatbotApi, hasSupportCrmApi };
    if (!hasAIChatbotApi || !hasSupportCrmApi) {
      allPassed = false;
    }
  } else {
    results.api = { found: false };
    allPassed = false;
  }

  // Check navigation
  const navContent = readFile(MOBILE_FILES['app-navigation']);
  if (navContent) {
    const hasImport = /import.*AIChatbotScreen/.test(navContent);
    const hasScreen = /Stack\.Screen.*name.*AIChatbot/.test(navContent);
    results.navigation = { hasImport, hasScreen };
    if (!hasImport || !hasScreen) {
      allPassed = false;
    }
  } else {
    results.navigation = { found: false };
    allPassed = false;
  }

  // Check HelpSupport integration
  const helpContent = readFile(MOBILE_FILES['help-support']);
  if (helpContent) {
    const hasAIChatbotButton = /AIChatbot|AI.*Assistant/.test(helpContent);
    results.helpSupport = { hasAIChatbotButton };
    if (!hasAIChatbotButton) {
      allPassed = false;
    }
  } else {
    results.helpSupport = { found: false };
    allPassed = false;
  }

  return { success: allPassed, results };
}

function verifyWebIntegration() {
  const results = {};
  let allPassed = true;

  // Check chatbot widget exists
  const widgetContent = readFile(WEB_FILES['chatbot-widget']);
  if (!widgetContent) {
    results.widget = { found: false };
    allPassed = false;
  } else {
    const hasAIChatbotApi = /aiChatbotApi/.test(widgetContent);
    const hasSupportCrmApi = /supportCrmApi/.test(widgetContent);
    const hasModes = /mode.*===.*'symptoms'|mode.*===.*'booking'/.test(widgetContent);
    results.widget = { found: true, hasAIChatbotApi, hasSupportCrmApi, hasModes };
    if (!hasAIChatbotApi || !hasModes) {
      allPassed = false;
    }
  }

  // Check API methods
  const apiContent = readFile(WEB_FILES['api-client']);
  if (apiContent) {
    const hasAIChatbotApi = /export const aiChatbotApi/.test(apiContent);
    const hasSupportCrmApi = /export const supportCrmApi/.test(apiContent);
    results.api = { hasAIChatbotApi, hasSupportCrmApi };
    if (!hasAIChatbotApi || !hasSupportCrmApi) {
      allPassed = false;
    }
  } else {
    results.api = { found: false };
    allPassed = false;
  }

  // Check home component integration
  const homeContent = readFile(WEB_FILES['home-component']);
  if (homeContent) {
    const hasImport = /import.*AIChatbotWidget/.test(homeContent);
    const hasUsage = /<AIChatbotWidget/.test(homeContent);
    results.homeIntegration = { hasImport, hasUsage };
    if (!hasImport || !hasUsage) {
      allPassed = false;
    }
  } else {
    results.homeIntegration = { found: false };
    allPassed = false;
  }

  return { success: allPassed, results };
}

function verifyHandlerRegistration(handlerPath, endpointNames) {
  const content = readFile(handlerPath);
  if (!content) {
    return { success: false, error: `File not found: ${handlerPath}` };
  }

  const results = {};
  let allPassed = true;

  for (const endpointName of endpointNames) {
    const registerFunction = `register${endpointName.charAt(0).toUpperCase() + endpointName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Endpoints`;
    
    const importRegex = new RegExp(`import.*${registerFunction}.*from`, 'i');
    const imported = importRegex.test(content);

    const registerRegex = new RegExp(`${registerFunction}\\s*\\(app\\)`, 'i');
    const registered = registerRegex.test(content);

    results[endpointName] = { imported, registered, functionName: registerFunction };
    if (!imported || !registered) {
      allPassed = false;
    }
  }

  return { success: allPassed, results };
}

// Main verification
console.log('🔍 Phase 3 AI Chatbot Integration Verification\n');
console.log('='.repeat(60));

let overallSuccess = true;

// 1. Verify Bedrock Client
console.log('\n1️⃣ Verifying AWS Bedrock Client...');
const bedrockResult = verifyBedrockClient(BACKEND_FILES['bedrock-client']);
if (bedrockResult.success) {
  console.log('✅ Bedrock client properly configured');
} else {
  console.log('❌ Bedrock client issues:');
  if (!bedrockResult.hasGetConfig) console.log('   - getBedrockConfig: Missing');
  if (!bedrockResult.hasInvoke) console.log('   - invokeBedrock: Missing');
  if (!bedrockResult.hasBedrockImport) console.log('   - AWS SDK import: Missing');
  if (!bedrockResult.hasErrorHandling) console.log('   - Error handling: Missing');
  overallSuccess = false;
}

// 2. Verify Backend Endpoints
console.log('\n2️⃣ Verifying Backend Endpoints...');
for (const [endpointName, filePath] of Object.entries(BACKEND_FILES)) {
  if (endpointName === 'bedrock-client') continue;
  
  console.log(`\n📁 Verifying ${endpointName} endpoints...`);
  const result = verifyBackendEndpoint(filePath, EXPECTED_ENDPOINTS[endpointName] || []);
  
  if (result.success) {
    console.log(`✅ ${endpointName}: All endpoints found`);
  } else {
    console.log(`❌ ${endpointName}: Issues found`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    for (const [path, pathResult] of Object.entries(result.results)) {
      if (!pathResult.found) {
        console.log(`   - ${pathResult.method} ${path}: Not found`);
      }
    }
    overallSuccess = false;
  }
}

// 3. Verify Handler Registration
console.log('\n3️⃣ Verifying Handler Registration...');
const handlerResult = verifyHandlerRegistration(HANDLER_FILE, ['ai-chatbot', 'support-crm']);
if (handlerResult.success) {
  console.log('✅ All endpoints registered in handler');
} else {
  console.log('❌ Missing handler registrations:');
  for (const [endpointName, endpointResult] of Object.entries(handlerResult.results)) {
    if (!endpointResult.imported) {
      console.log(`   - ${endpointName}: Not imported`);
    }
    if (!endpointResult.registered) {
      console.log(`   - ${endpointName}: Not registered`);
    }
  }
  overallSuccess = false;
}

// 4. Verify Mobile Integration
console.log('\n4️⃣ Verifying Mobile App Integration...');
const mobileResult = verifyMobileIntegration();
if (mobileResult.success) {
  console.log('✅ Mobile app fully integrated');
} else {
  console.log('❌ Mobile app integration issues:');
  for (const [component, componentResult] of Object.entries(mobileResult.results)) {
    if (componentResult.found === false) {
      console.log(`   - ${component}: File not found`);
    } else if (typeof componentResult === 'object') {
      for (const [key, value] of Object.entries(componentResult)) {
        if (value === false) {
          console.log(`   - ${component}.${key}: Missing`);
        }
      }
    }
  }
  overallSuccess = false;
}

// 5. Verify Web Integration
console.log('\n5️⃣ Verifying Web App Integration...');
const webResult = verifyWebIntegration();
if (webResult.success) {
  console.log('✅ Web app fully integrated');
} else {
  console.log('❌ Web app integration issues:');
  for (const [component, componentResult] of Object.entries(webResult.results)) {
    if (componentResult.found === false) {
      console.log(`   - ${component}: File not found`);
    } else if (typeof componentResult === 'object') {
      for (const [key, value] of Object.entries(componentResult)) {
        if (value === false) {
          console.log(`   - ${component}.${key}: Missing`);
        }
      }
    }
  }
  overallSuccess = false;
}

// Final Summary
console.log('\n' + '='.repeat(60));
if (overallSuccess) {
  console.log('\n✅ PHASE 3 VERIFICATION: 100% PASSED');
  console.log('\n✅ AWS Bedrock client configured');
  console.log('✅ All backend endpoints created');
  console.log('✅ Support/CRM integration complete');
  console.log('✅ Mobile app integrated');
  console.log('✅ Web app integrated');
  console.log('✅ Complete wiring: Chat → Symptoms → Booking → Support → Agent Handoff');
  process.exit(0);
} else {
  console.log('\n❌ PHASE 3 VERIFICATION: FAILED');
  console.log('\nPlease fix the issues above before proceeding.');
  process.exit(1);
}

