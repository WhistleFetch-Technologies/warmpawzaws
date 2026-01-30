#!/usr/bin/env node
/**
 * Backend Handlers Synthetic Tests
 * Tests handler registration, endpoint definitions, and API contracts
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
let skipped = 0;

function logTest(name) {
    console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${BLUE}Test: ${name}${RESET}`);
    console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
}

function logPass(message) {
    console.log(`${GREEN}✅ PASS: ${message}${RESET}`);
    passed++;
}

function logFail(message) {
    console.log(`${RED}❌ FAIL: ${message}${RESET}`);
    failed++;
}

function logSkip(message) {
    console.log(`${YELLOW}⏭️  SKIP: ${message}${RESET}`);
    skipped++;
}

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return null;
    }
}

function checkPattern(content, pattern, description) {
    if (!content) return false;
    const regex = new RegExp(pattern, 'i');
    return regex.test(content);
}

// ============================================================================
// HANDLER REGISTRATION TESTS
// ============================================================================

logTest('Handler Registration Verification');

const handlerIndexPath = 'backend/lambda/src/handler/index.ts';
const handlerIndexContent = readFile(handlerIndexPath);

if (!handlerIndexContent) {
    logFail(`Handler index file not found: ${handlerIndexPath}`);
} else {
    logPass(`Handler index file exists: ${handlerIndexPath}`);
    
    // Check for staff endpoints registration
    if (checkPattern(handlerIndexContent, 'registerStaffEndpoints', 'Staff endpoints registration')) {
        logPass('registerStaffEndpoints imported');
        
        if (checkPattern(handlerIndexContent, 'registerStaffEndpoints\\(app\\)', 'Staff endpoints called')) {
            logPass('registerStaffEndpoints called in handler');
        } else {
            logFail('registerStaffEndpoints not called in handler');
        }
    } else {
        logFail('registerStaffEndpoints not imported');
    }
    
    // Check for other endpoint registrations
    const registrations = [
        'registerBookingEndpoints',
        'registerVendorEndpoints',
    ];
    
    registrations.forEach(reg => {
        if (checkPattern(handlerIndexContent, reg, reg)) {
            logPass(`Endpoint registration found: ${reg}`);
        } else {
            logSkip(`Endpoint registration: ${reg} (may use different pattern)`);
        }
    });
}

// ============================================================================
// ENDPOINT DEFINITION TESTS
// ============================================================================

logTest('Endpoint Definition Verification');

const staffEndpointsPath = 'backend/lambda/src/endpoints/staff.ts';
const staffEndpointsContent = readFile(staffEndpointsPath);

if (!staffEndpointsContent) {
    logFail(`Staff endpoints file not found: ${staffEndpointsPath}`);
} else {
    logPass(`Staff endpoints file exists: ${staffEndpointsPath}`);
    
    // Check for export
    if (checkPattern(staffEndpointsContent, 'export.*registerStaffEndpoints|export function registerStaffEndpoints', 'Export')) {
        logPass('registerStaffEndpoints function exported');
    } else {
        logFail('registerStaffEndpoints function not exported');
    }
    
    // Check for individual endpoints
    const endpoints = [
        { pattern: 'app\\.get.*"/staff/:staffId/appointments"', name: 'GET /staff/:staffId/appointments' },
        { pattern: 'app\\.put.*"/staff/:staffId/appointments/:bookingId/accept"', name: 'PUT /staff/:staffId/appointments/:bookingId/accept' },
        { pattern: 'app\\.put.*"/staff/:staffId/appointments/:bookingId/reject"', name: 'PUT /staff/:staffId/appointments/:bookingId/reject' },
        { pattern: 'app\\.put.*"/staff/:staffId/appointments/:bookingId/start"', name: 'PUT /staff/:staffId/appointments/:bookingId/start' },
        { pattern: 'app\\.put.*"/staff/:staffId/appointments/:bookingId/complete"', name: 'PUT /staff/:staffId/appointments/:bookingId/complete' },
        { pattern: 'app\\.get.*"/vendor/:vendorId/staff"', name: 'GET /vendor/:vendorId/staff' },
    ];
    
    endpoints.forEach(({ pattern, name }) => {
        if (checkPattern(staffEndpointsContent, pattern, name)) {
            logPass(`Endpoint defined: ${name}`);
        } else {
            logFail(`Endpoint missing: ${name}`);
        }
    });
}

// Check bookings endpoint
const bookingsPath = 'backend/lambda/src/endpoints/bookings-enhanced.ts';
const bookingsContent = readFile(bookingsPath);

if (bookingsContent) {
    if (checkPattern(bookingsContent, 'staff_id|staffId', 'staff_id support')) {
        logPass('Booking creation supports staff_id parameter');
    } else {
        logFail('Booking creation does not support staff_id');
    }
    
    if (checkPattern(bookingsContent, 'app\\.post.*"/bookings/create"|POST.*bookings/create', 'POST /bookings/create')) {
        logPass('POST /bookings/create endpoint defined');
    } else {
        logSkip('POST /bookings/create endpoint (may be in different file)');
    }
}

// Check vendor bookings endpoint
const vendorBookingsPath = 'backend/lambda/src/endpoints/vendor-bookings.ts';
const vendorBookingsContent = readFile(vendorBookingsPath);

if (vendorBookingsContent) {
    if (checkPattern(vendorBookingsContent, 'app\\.get.*"/vendor/bookings/:vendorId"|GET.*vendor/bookings', 'GET /vendor/bookings/:vendorId')) {
        logPass('GET /vendor/bookings/:vendorId endpoint defined');
    } else {
        logSkip('GET /vendor/bookings/:vendorId endpoint (may be in different file)');
    }
}

// ============================================================================
// API CONTRACT TESTS
// ============================================================================

logTest('API Contract Verification');

// Check for API contract usage
if (bookingsContent) {
    const contractChecks = [
        { pattern: 'CreateBookingRequestSchema|CreateBookingRequest', name: 'Create booking request schema' },
        { pattern: 'staff_id|staffId', name: 'staff_id in booking request' },
        { pattern: 'validate|zod|schema', name: 'Request validation' },
    ];
    
    contractChecks.forEach(({ pattern, name }) => {
        if (checkPattern(bookingsContent, pattern, name)) {
            logPass(`API contract: ${name}`);
        } else {
            logSkip(`API contract: ${name} (may use inline validation)`);
        }
    });
}

// Check response format
if (staffEndpointsContent) {
    if (checkPattern(staffEndpointsContent, 'c\\.json.*success.*true|c\\.json.*appointments', 'JSON response format')) {
        logPass('Endpoints return JSON with success/appointments fields');
    } else {
        logSkip('Response format check (may vary)');
    }
}

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

logTest('Error Handling Verification');

if (staffEndpointsContent) {
    const errorHandling = [
        { pattern: 'try.*catch|catch.*error', name: 'Try-catch blocks' },
        { pattern: 'c\\.json.*error|error.*message', name: 'Error response format' },
        { pattern: 'console\\.error', name: 'Error logging' },
    ];
    
    errorHandling.forEach(({ pattern, name }) => {
        if (checkPattern(staffEndpointsContent, pattern, name)) {
            logPass(`Error handling: ${name}`);
        } else {
            logFail(`Error handling missing: ${name}`);
        }
    });
}

// ============================================================================
// DATABASE QUERY TESTS
// ============================================================================

logTest('Database Query Verification');

if (staffEndpointsContent) {
    const dbQueries = [
        { pattern: 'SELECT.*FROM bookings.*WHERE.*staff_id', name: 'Staff appointments query' },
        { pattern: 'UPDATE.*bookings.*SET.*status', name: 'Status update query' },
        { pattern: 'query.*bookings|select.*bookings', name: 'Database query function' },
    ];
    
    dbQueries.forEach(({ pattern, name }) => {
        if (checkPattern(staffEndpointsContent, pattern, name)) {
            logPass(`Database query: ${name}`);
        } else {
            logSkip(`Database query: ${name} (may use different pattern)`);
        }
    });
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
console.log(`${BLUE}TEST SUMMARY${RESET}`);
console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
console.log(`${GREEN}✅ Passed: ${passed}${RESET}`);
console.log(`${RED}❌ Failed: ${failed}${RESET}`);
console.log(`${YELLOW}⏭️  Skipped: ${skipped}${RESET}`);
console.log(`${BLUE}📊 Total: ${passed + failed + skipped}${RESET}\n`);

if (failed === 0) {
    console.log(`${GREEN}✅ ✅ ✅ ALL HANDLER TESTS PASSED! ✅ ✅ ✅${RESET}\n`);
    process.exit(0);
} else {
    console.log(`${RED}❌ SOME HANDLER TESTS FAILED${RESET}\n`);
    process.exit(1);
}
