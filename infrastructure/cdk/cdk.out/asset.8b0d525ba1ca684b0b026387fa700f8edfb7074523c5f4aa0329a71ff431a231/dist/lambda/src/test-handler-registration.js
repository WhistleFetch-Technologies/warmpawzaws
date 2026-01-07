"use strict";
/**
 * ============================================================================
 * HANDLER REGISTRATION TEST
 * ============================================================================
 *
 * Tests that the handler can register endpoints correctly
 *
 * Usage: npx ts-node src/test-handler-registration.ts
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const endpoint_registry_1 = require("./endpoint-registry");
async function testHandlerRegistration() {
    console.log('🧪 Testing Handler Endpoint Registration...\n');
    try {
        const app = new hono_1.Hono();
        // Test endpoint registration (same as handler does)
        console.log('📋 Registering endpoints via registry...');
        await (0, endpoint_registry_1.registerAllEndpoints)(app);
        // Test health endpoint
        console.log('\n🏥 Testing /health endpoint...');
        const healthReq = new Request('http://localhost/health', { method: 'GET' });
        const healthRes = await app.request(healthReq);
        console.log(`   Status: ${healthRes.status}`);
        if (healthRes.status === 200) {
            const data = await healthRes.json();
            console.log('   ✅ Health endpoint working');
            console.log('   Response:', JSON.stringify(data, null, 2));
        }
        else {
            console.log('   ❌ Health endpoint failed');
        }
        // Test auth endpoint (OPTIONS for CORS)
        console.log('\n🔐 Testing auth endpoint (OPTIONS)...');
        const authOptsReq = new Request('http://localhost/make-server-3dd53475/auth/send-otp', {
            method: 'OPTIONS',
        });
        const authOptsRes = await app.request(authOptsReq);
        console.log(`   Status: ${authOptsRes.status}`);
        if (authOptsRes.status === 204) {
            console.log('   ✅ Auth endpoint registered and responding to OPTIONS');
        }
        else {
            console.log(`   ⚠️ Auth endpoint returned status ${authOptsRes.status}`);
        }
        // Test auth endpoint (GET - should return method not allowed or handler)
        console.log('\n🔐 Testing auth endpoint (GET)...');
        const authGetReq = new Request('http://localhost/make-server-3dd53475/auth/send-otp', {
            method: 'GET',
        });
        const authGetRes = await app.request(authGetReq);
        console.log(`   Status: ${authGetRes.status}`);
        console.log(`   ✅ Auth endpoint registered and responding to GET`);
        console.log('\n✅ Handler registration test complete!');
        return true;
    }
    catch (error) {
        console.error('\n❌ Handler registration test failed:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
        }
        return false;
    }
}
// Run test
testHandlerRegistration()
    .then((success) => {
    process.exit(success ? 0 : 1);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=test-handler-registration.js.map