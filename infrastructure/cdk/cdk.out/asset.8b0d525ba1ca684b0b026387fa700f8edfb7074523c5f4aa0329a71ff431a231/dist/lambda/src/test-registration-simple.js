/**
 * ============================================================================
 * SIMPLE ENDPOINT REGISTRATION TEST
 * ============================================================================
 *
 * Simple test to verify auth endpoint can be imported and registered
 * ============================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
async function testAuthEndpointImport() {
    console.log('🧪 Testing Auth Endpoint Import...\n');
    try {
        // Test importing auth endpoint
        console.log('📦 Importing auth endpoint...');
        const authModule = await Promise.resolve().then(() => __importStar(require('./endpoints/auth-endpoints')));
        console.log('✅ Auth module imported successfully');
        console.log('   Exports:', Object.keys(authModule));
        if (typeof authModule.registerAuthEndpoints === 'function') {
            console.log('✅ registerAuthEndpoints function found');
            // Test creating Hono app
            const { Hono } = await Promise.resolve().then(() => __importStar(require('hono')));
            const app = new Hono();
            // Test registering endpoint
            console.log('📋 Registering auth endpoints...');
            authModule.registerAuthEndpoints(app);
            console.log('✅ Auth endpoints registered successfully');
            console.log('\n✅ All tests passed!');
            return true;
        }
        else {
            console.error('❌ registerAuthEndpoints is not a function');
            return false;
        }
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
        }
        return false;
    }
}
// Run test
testAuthEndpointImport()
    .then((success) => {
    process.exit(success ? 0 : 1);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=test-registration-simple.js.map