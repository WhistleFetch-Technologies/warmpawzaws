/**
 * Session Management & Authentication Test Suite (Node.js)
 * Tests all logout flows, token expiry, and session persistence
 */

const https = require('https');

// Configuration
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'vpvpbdwtyugbknrntkho';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475`;

// Test data
const TEST_PHONE = '9876543210';

// Test counters
let passed = 0;
let failed = 0;
let total = 0;

// Helper functions
function logInfo(message) {
    console.log(`ℹ️  ${message}`);
}

function logSuccess(message) {
    console.log(`✅ ${message}`);
    passed++;
    total++;
}

function logError(message) {
    console.log(`❌ ${message}`);
    failed++;
    total++;
}

function logWarning(message) {
    console.log(`⚠️  ${message}`);
}

function makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}${endpoint}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed, raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, raw: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

function calculateDaysUntilExpiry(expiresAt) {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry - now;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function calculateHoursUntilExpiry(expiresAt) {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry - now;
    return Math.floor(diffMs / (1000 * 60 * 60));
}

async function testDeviceDetection() {
    console.log('\n📱 Testing Device Detection in Login');
    console.log('-----------------------------------');

    // Test mobile app login (should get 365 days)
    logInfo('Testing mobile app login (should get 365 days expiry)');
    try {
        const response = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'mobile',
            isMobileApp: true
        });

        if (response.data.success) {
            const expiresAt = response.data.data?.session?.expiresAt || 
                            response.data.data?.supabaseTokens?.expiresAt;
            
            if (expiresAt) {
                const daysDiff = calculateDaysUntilExpiry(expiresAt);
                if (daysDiff >= 360 && daysDiff <= 370) {
                    logSuccess(`Mobile app login - Token expiry ~365 days (${daysDiff} days)`);
                } else {
                    logError(`Mobile app login - Expected ~365 days, got ${daysDiff} days`);
                }
            } else {
                logError('Mobile app login - No expiry date in response');
            }
        } else {
            logError('Mobile app login - Request failed');
            console.log(JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        logError(`Mobile app login - Error: ${error.message}`);
    }

    // Test web customer login (should get 48 hours)
    logInfo('Testing web customer login (should get 48 hours expiry)');
    try {
        const response = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web',
            isMobileApp: false
        });

        if (response.data.success) {
            const expiresAt = response.data.data?.session?.expiresAt || 
                            response.data.data?.supabaseTokens?.expiresAt;
            
            if (expiresAt) {
                const hoursDiff = calculateHoursUntilExpiry(expiresAt);
                if (hoursDiff >= 47 && hoursDiff <= 49) {
                    logSuccess(`Web customer login - Token expiry ~48 hours (${hoursDiff} hours)`);
                } else {
                    logError(`Web customer login - Expected ~48 hours, got ${hoursDiff} hours`);
                }
            } else {
                logError('Web customer login - No expiry date in response');
            }
        } else {
            logError('Web customer login - Request failed');
            console.log(JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        logError(`Web customer login - Error: ${error.message}`);
    }
}

async function testSessionVerification() {
    console.log('\n✅ Testing Session Verification');
    console.log('-------------------------------');

    // Create a session first
    try {
        const loginResponse = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web'
        });

        if (loginResponse.data.success) {
            const sessionId = loginResponse.data.data?.session?.sessionId;
            
            if (sessionId) {
                // Verify session
                const verifyResponse = await makeRequest('POST', '/auth/verify-session', {
                    sessionId: sessionId
                });

                if (verifyResponse.status === 200 && verifyResponse.data.success) {
                    logSuccess('Session verification - Valid session verified');
                } else {
                    logError('Session verification - Failed to verify valid session');
                }
            } else {
                logError('Session verification - No session ID in login response');
            }
        } else {
            logError('Session verification - Failed to create session');
        }
    } catch (error) {
        logError(`Session verification - Error: ${error.message}`);
    }
}

async function testLogout() {
    console.log('\n👋 Testing Logout Functionality');
    console.log('-------------------------------');

    // Test logout by sessionId
    try {
        const loginResponse = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web'
        });

        if (loginResponse.data.success) {
            const sessionId = loginResponse.data.data?.session?.sessionId;
            
            if (sessionId) {
                const logoutResponse = await makeRequest('POST', '/auth/logout', {
                    sessionId: sessionId
                });

                if (logoutResponse.status === 200 && logoutResponse.data.success) {
                    logSuccess('Logout by sessionId - Success');
                } else {
                    logError('Logout by sessionId - Failed');
                }
            }
        }
    } catch (error) {
        logError(`Logout by sessionId - Error: ${error.message}`);
    }

    // Test logout by userId
    try {
        const loginResponse = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web'
        });

        if (loginResponse.data.success) {
            const userId = loginResponse.data.data?.session?.userId;
            
            if (userId) {
                const logoutResponse = await makeRequest('POST', '/auth/logout', {
                    userId: userId
                });

                if (logoutResponse.status === 200 && logoutResponse.data.success) {
                    logSuccess('Logout by userId - Success');
                } else {
                    logError('Logout by userId - Failed');
                }
            }
        }
    } catch (error) {
        logError(`Logout by userId - Error: ${error.message}`);
    }

    // Test logout all devices
    try {
        const loginResponse = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web'
        });

        if (loginResponse.data.success) {
            const userId = loginResponse.data.data?.session?.userId;
            
            if (userId) {
                const logoutResponse = await makeRequest('POST', '/auth/logout', {
                    userId: userId,
                    logoutAll: true
                });

                if (logoutResponse.status === 200 && logoutResponse.data.success) {
                    logSuccess('Logout from all devices - Success');
                } else {
                    logError('Logout from all devices - Failed');
                }
            }
        }
    } catch (error) {
        logError(`Logout from all devices - Error: ${error.message}`);
    }
}

async function testSupabaseTokens() {
    console.log('\n🔑 Testing Supabase Token Generation');
    console.log('-------------------------------------');

    try {
        const response = await makeRequest('POST', '/auth/login', {
            phone: TEST_PHONE,
            portal: 'customer',
            deviceType: 'web'
        });

        if (response.data.success) {
            const supabaseTokens = response.data.data?.supabaseTokens;
            
            if (supabaseTokens) {
                if (supabaseTokens.accessToken) {
                    logSuccess('Supabase access token generated');
                } else {
                    logError('Supabase access token not generated');
                }
                
                if (supabaseTokens.refreshToken) {
                    logSuccess('Supabase refresh token generated');
                } else {
                    logWarning('Supabase refresh token not generated (may be expected)');
                }
                
                if (supabaseTokens.expiresAt) {
                    logSuccess(`Supabase token expiry: ${supabaseTokens.expiresAt}`);
                }
            } else {
                logWarning('Supabase tokens not in response (may be expected if service key not configured)');
            }
        } else {
            logError('Failed to login for Supabase token test');
        }
    } catch (error) {
        logError(`Supabase token test - Error: ${error.message}`);
    }
}

async function runAllTests() {
    console.log('\n==========================================');
    console.log('  Session Management Test Suite');
    console.log('==========================================\n');

    await testDeviceDetection();
    await testSessionVerification();
    await testLogout();
    await testSupabaseTokens();

    console.log('\n==========================================');
    console.log('  Test Summary');
    console.log('==========================================\n');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}\n`);

    if (failed === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

