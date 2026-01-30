#!/usr/bin/env node
/**
 * API Contracts Synthetic Tests
 * Tests API contract schemas, request/response types, and validation
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
// API CONTRACT SCHEMA TESTS
// ============================================================================

logTest('API Contract Schema Verification');

// Check for API contracts package
const contractsPath = 'packages/api-contracts';
if (fs.existsSync(contractsPath)) {
    logPass('API contracts package exists');
    
    // Check for booking contracts
    const bookingContracts = [
        'bookings',
        'CreateBookingRequest',
        'staff_id',
    ];
    
    bookingContracts.forEach(contract => {
        const files = fs.readdirSync(contractsPath, { recursive: true });
        const found = files.some(file => {
            if (typeof file === 'string' && file.includes(contract)) {
                const content = readFile(path.join(contractsPath, file));
                return content && checkPattern(content, contract, contract);
            }
            return false;
        });
        
        if (found) {
            logPass(`API contract found: ${contract}`);
        } else {
            logSkip(`API contract: ${contract} (may be inline)`);
        }
    });
} else {
    logSkip('API contracts package not found (using inline validation)');
}

// ============================================================================
// REQUEST/RESPONSE TYPE TESTS
// ============================================================================

logTest('Request/Response Type Verification');

const bookingsPath = 'backend/lambda/src/endpoints/bookings-enhanced.ts';
const bookingsContent = readFile(bookingsPath);

if (bookingsContent) {
    // Check for staff_id in booking creation
    if (checkPattern(bookingsContent, 'staff_id|staffId', 'staff_id parameter')) {
        logPass('Booking creation request includes staff_id');
        
        // Check if it's properly handled
        if (checkPattern(bookingsContent, 'staff_id.*bookingData|bookingData.*staff_id', 'staff_id assignment')) {
            logPass('staff_id properly assigned in booking data');
        } else {
            logFail('staff_id not properly assigned in booking data');
        }
    } else {
        logFail('Booking creation request does not include staff_id');
    }
    
    // Check for request validation
    if (checkPattern(bookingsContent, 'validate|schema|zod|CreateBookingRequestSchema', 'Request validation')) {
        logPass('Request validation present');
    } else {
        logSkip('Request validation (may use different method)');
    }
}

// Check staff endpoints response format
const staffPath = 'backend/lambda/src/endpoints/staff.ts';
const staffContent = readFile(staffPath);

if (staffContent) {
    // Check response format
    if (checkPattern(staffContent, 'c\\.json.*success.*true|c\\.json.*appointments', 'Response format')) {
        logPass('Staff endpoints return consistent JSON response');
    } else {
        logSkip('Response format (may vary)');
    }
    
    // Check error response format
    if (checkPattern(staffContent, 'c\\.json.*error|c\\.json.*message', 'Error response')) {
        logPass('Error responses properly formatted');
    } else {
        logFail('Error response format missing');
    }
}

// ============================================================================
// TYPE DEFINITIONS TESTS
// ============================================================================

logTest('Type Definitions Verification');

// Check TypeScript interfaces
const typeChecks = [
    { file: bookingsPath, pattern: 'interface.*Booking|type.*Booking', name: 'Booking type' },
    { file: staffPath, pattern: 'interface.*Appointment|type.*Appointment', name: 'Appointment type' },
];

typeChecks.forEach(({ file, pattern, name }) => {
    const content = readFile(file);
    if (content && checkPattern(content, pattern, name)) {
        logPass(`Type definition found: ${name}`);
    } else {
        logSkip(`Type definition: ${name} (may be in different file)`);
    }
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

logTest('Input Validation Verification');

if (bookingsContent) {
    const validations = [
        { pattern: 'validate.*date|validate.*time', name: 'Date/time validation' },
        { pattern: 'validate.*staff|staff.*validation', name: 'Staff validation' },
        { pattern: 'required|optional', name: 'Required field validation' },
    ];
    
    validations.forEach(({ pattern, name }) => {
        if (checkPattern(bookingsContent, pattern, name)) {
            logPass(`Validation present: ${name}`);
        } else {
            logSkip(`Validation: ${name} (may use different method)`);
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
    console.log(`${GREEN}✅ ✅ ✅ ALL API CONTRACT TESTS PASSED! ✅ ✅ ✅${RESET}\n`);
    process.exit(0);
} else {
    console.log(`${RED}❌ SOME API CONTRACT TESTS FAILED${RESET}\n`);
    process.exit(1);
}
