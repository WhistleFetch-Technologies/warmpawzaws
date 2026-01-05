"use strict";
/**
 * ============================================================================
 * ENDPOINT REGISTRATION TEST
 * ============================================================================
 *
 * Test script to verify endpoint registration works
 *
 * Usage: npx ts-node src/test-endpoint-registration.ts
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const endpoint_registry_1 = require("./endpoint-registry");
async function testEndpointRegistration() {
    console.log('🧪 Testing Endpoint Registration...\n');
    try {
        // Create Hono app
        const app = new hono_1.Hono();
        // Register all endpoints
        console.log('📋 Registering endpoints...\n');
        await (0, endpoint_registry_1.registerAllEndpoints)(app);
        // Test route discovery
        console.log('\n🔍 Testing route discovery...');
        // Get all registered routes
        const routes = [];
        app.showRoutes().forEach((route) => {
            routes.push(`${route.method} ${route.path}`);
        });
        console.log(`\n✅ Found ${routes.length} registered routes:`);
        routes.slice(0, 20).forEach((route) => {
            console.log(`   ${route}`);
        });
        if (routes.length > 20) {
            console.log(`   ... and ${routes.length - 20} more routes`);
        }
        // Test health endpoint
        console.log('\n🏥 Testing health endpoint...');
        const healthResponse = await app.request('/health');
        console.log(`   Status: ${healthResponse.status}`);
        if (healthResponse.status === 200) {
            const healthData = await healthResponse.json();
            console.log(`   Response:`, healthData);
            console.log('   ✅ Health endpoint working');
        }
        else {
            console.log('   ❌ Health endpoint failed');
        }
        // Test auth endpoint (if registered)
        console.log('\n🔐 Testing auth endpoint registration...');
        const authRoutes = routes.filter(r => r.includes('auth'));
        if (authRoutes.length > 0) {
            console.log(`   ✅ Found ${authRoutes.length} auth routes:`);
            authRoutes.slice(0, 5).forEach((route) => {
                console.log(`      ${route}`);
            });
        }
        else {
            console.log('   ⚠️ No auth routes found (may not be registered yet)');
        }
        console.log('\n✅ Endpoint registration test complete!');
        return true;
    }
    catch (error) {
        console.error('\n❌ Endpoint registration test failed:', error);
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Stack:', error.stack);
        }
        return false;
    }
}
// Run test
testEndpointRegistration()
    .then((success) => {
    process.exit(success ? 0 : 1);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=test-endpoint-registration.js.map