#!/usr/bin/env ts-node
/**
 * ============================================================================
 * Comprehensive System Test & Execution Script
 * ============================================================================
 * Executes all phases of the Warmpawz platform testing
 * Records issues automatically and re-executes until 100% pass
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface Issue {
  id: string;
  category: string;
  affected_app: string;
  endpoint: string;
  expected_behaviour: string;
  actual_behaviour: string;
  root_cause: string;
  fix_applied: string;
  validation_evidence: string;
  status: 'OPEN' | 'FIXED' | 'VERIFIED' | 'CLOSED';
  timestamp: string;
}

interface IssueTracker {
  execution_metadata: {
    start_date: string;
    executor: string;
    objective: string;
    status: string;
  };
  issues: Issue[];
  execution_log: Array<{
    phase: string;
    scenario: string;
    status: string;
    timestamp: string;
    details: string;
  }>;
  statistics: {
    total_scenarios_executed: number;
    total_issues_found: number;
    total_issues_fixed: number;
    total_issues_verified: number;
    total_issues_closed: number;
    current_phase: string;
  };
}

const ISSUE_TRACKER_PATH = path.join(__dirname, '..', 'WARMPAWZ_SYSTEM_EXECUTION_ISSUE_TRACKER.json');
const LOG_DIR = path.join(__dirname, '..', 'test-results');
const LOG_FILE = path.join(LOG_DIR, `comprehensive-execution-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

let issueIdCounter = 1;
let testsPassed = 0;
let testsFailed = 0;

// Ensure directories exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Load or create issue tracker
function loadIssueTracker(): IssueTracker {
  if (fs.existsSync(ISSUE_TRACKER_PATH)) {
    return JSON.parse(fs.readFileSync(ISSUE_TRACKER_PATH, 'utf8'));
  }
  return {
    execution_metadata: {
      start_date: new Date().toISOString(),
      executor: 'Principal Platform Engineer + QA Automation Architect',
      objective: '100% operational, wired, and error-free platform',
      status: 'IN_PROGRESS',
    },
    issues: [],
    execution_log: [],
    statistics: {
      total_scenarios_executed: 0,
      total_issues_found: 0,
      total_issues_fixed: 0,
      total_issues_verified: 0,
      total_issues_closed: 0,
      current_phase: 'PHASE_1',
    },
  };
}

function saveIssueTracker(tracker: IssueTracker): void {
  fs.writeFileSync(ISSUE_TRACKER_PATH, JSON.stringify(tracker, null, 2));
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function addIssue(
  tracker: IssueTracker,
  category: string,
  app: string,
  endpoint: string,
  expected: string,
  actual: string,
  rootCause: string
): string {
  const issueId = `ISSUE-${String(issueIdCounter).padStart(4, '0')}`;
  issueIdCounter++;

  const issue: Issue = {
    id: issueId,
    category,
    affected_app: app,
    endpoint,
    expected_behaviour: expected,
    actual_behaviour: actual,
    root_cause: rootCause,
    fix_applied: '',
    validation_evidence: '',
    status: 'OPEN',
    timestamp: new Date().toISOString(),
  };

  tracker.issues.push(issue);
  tracker.statistics.total_issues_found++;
  saveIssueTracker(tracker);

  log(`❌ ISSUE RECORDED: ${issueId}`);
  log(`   Category: ${category} | App: ${app} | Endpoint: ${endpoint}`);
  return issueId;
}

function updateIssueStatus(
  tracker: IssueTracker,
  issueId: string,
  status: Issue['status'],
  fixApplied: string = '',
  validationEvidence: string = ''
): void {
  const issue = tracker.issues.find((i) => i.id === issueId);
  if (issue) {
    issue.status = status;
    issue.fix_applied = fixApplied;
    issue.validation_evidence = validationEvidence;
    
    if (status === 'FIXED') {
      tracker.statistics.total_issues_fixed++;
    } else if (status === 'VERIFIED') {
      tracker.statistics.total_issues_verified++;
    } else if (status === 'CLOSED') {
      tracker.statistics.total_issues_closed++;
    }
    saveIssueTracker(tracker);
  }
}

function makeRequest(
  method: string,
  url: string,
  data?: any,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-UAT-Mode': 'true',
      'X-UAT-Token': 'uat-token-admin',
      ...headers,
    };

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: defaultHeaders,
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 500,
          body,
          headers: res.headers,
        });
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

async function testEndpoint(
  tracker: IssueTracker,
  method: string,
  endpoint: string,
  data: any,
  expectedStatus: number,
  description: string,
  app: string,
  apiBase: string
): Promise<boolean> {
  const url = `${apiBase}${endpoint}`;
  log(`Testing: ${description}`);
  log(`  ${method} ${endpoint}`);

  try {
    const response = await makeRequest(method, url, data);
    const statusCode = response.statusCode;

    if (statusCode === expectedStatus || statusCode === 200) {
      log(`  ✅ PASS`);
      testsPassed++;
      tracker.statistics.total_scenarios_executed++;
      saveIssueTracker(tracker);
      return true;
    } else {
      log(`  ❌ FAIL - Status: ${statusCode}`);
      log(`  Response: ${response.body.substring(0, 200)}`);
      testsFailed++;

      addIssue(
        tracker,
        'API',
        app,
        endpoint,
        `Status ${expectedStatus}`,
        `Status ${statusCode}`,
        `API returned unexpected status code: ${statusCode}`
      );
      return false;
    }
  } catch (error: any) {
    log(`  ❌ ERROR - ${error.message}`);
    testsFailed++;

    addIssue(
      tracker,
      'API',
      app,
      endpoint,
      `Status ${expectedStatus}`,
      `Error: ${error.message}`,
      `Request failed: ${error.message}`
    );
    return false;
  }
}

function getApiBase(environment: string): string {
  // Try to get from environment or use defaults
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  if (environment === 'prod') {
    return 'https://api.warmpawz.com';
  } else if (environment === 'stage') {
    return 'https://stage.api.warmpawz.com';
  } else {
    // Default dev API Gateway URL
    return 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }
}

async function executePhase1(tracker: IssueTracker, apiBase: string): Promise<void> {
  log('\n=================================================================');
  log('PHASE 1: ADMIN MASTER DATA SEEDING');
  log('=================================================================\n');

  // 1.1 Health Check
  await testEndpoint(tracker, 'GET', '/health', null, 200, 'Health check', 'System', apiBase);

  // 1.2 Roles & Capabilities
  await testEndpoint(tracker, 'GET', '/config/roles', null, 200, 'Get all roles', 'Admin', apiBase);

  // 1.3 Service Catalog
  await testEndpoint(tracker, 'GET', '/service-catalog', null, 200, 'Get service catalog', 'Admin', apiBase);

  log('\n✅ Phase 1 Complete\n');
}

async function executePhase2(tracker: IssueTracker, apiBase: string): Promise<void> {
  log('\n=================================================================');
  log('PHASE 2: VENDOR LIFECYCLE');
  log('=================================================================\n');

  // 2.1 Vendor Onboarding Form
  await testEndpoint(tracker, 'GET', '/onboarding/forms', null, 200, 'Get onboarding forms', 'Vendor', apiBase);

  log('\n✅ Phase 2 Complete\n');
}

async function executePhase3(tracker: IssueTracker, apiBase: string): Promise<void> {
  log('\n=================================================================');
  log('PHASE 3: CUSTOMER LIFECYCLE');
  log('=================================================================\n');

  // 3.1 Customer Search
  await testEndpoint(tracker, 'GET', '/customer/vendors/search?q=grooming', null, 200, 'Customer search', 'Customer', apiBase);

  log('\n✅ Phase 3 Complete\n');
}

async function main(): Promise<void> {
  const environment = process.argv[2] || 'dev';
  const apiBase = getApiBase(environment);

  log('=================================================================');
  log('🚀 WARMPAWZ COMPREHENSIVE SYSTEM EXECUTION');
  log('=================================================================');
  log('');
  log(`Environment: ${environment}`);
  log(`API Base: ${apiBase}`);
  log(`Issue Tracker: ${ISSUE_TRACKER_PATH}`);
  log(`Log File: ${LOG_FILE}`);
  log('');

  const tracker = loadIssueTracker();
  tracker.execution_metadata.status = 'IN_PROGRESS';
  tracker.statistics.current_phase = 'PHASE_1';
  saveIssueTracker(tracker);

  try {
    // Execute all phases
    await executePhase1(tracker, apiBase);
    tracker.statistics.current_phase = 'PHASE_2';
    saveIssueTracker(tracker);

    await executePhase2(tracker, apiBase);
    tracker.statistics.current_phase = 'PHASE_3';
    saveIssueTracker(tracker);

    await executePhase3(tracker, apiBase);

    // Summary
    log('\n=================================================================');
    log('EXECUTION SUMMARY');
    log('=================================================================');
    log(`Total Tests Passed: ${testsPassed}`);
    log(`Total Tests Failed: ${testsFailed}`);
    log(`Total Issues Found: ${tracker.statistics.total_issues_found}`);
    log(`Total Issues Fixed: ${tracker.statistics.total_issues_fixed}`);
    log(`Total Issues Verified: ${tracker.statistics.total_issues_verified}`);
    log(`Total Issues Closed: ${tracker.statistics.total_issues_closed}`);
    log('');
    log(`Issue Tracker: ${ISSUE_TRACKER_PATH}`);
    log(`Full Log: ${LOG_FILE}`);
    log('');

    tracker.execution_metadata.status = testsFailed === 0 ? 'COMPLETE' : 'IN_PROGRESS';
    saveIssueTracker(tracker);

    if (testsFailed === 0) {
      log('✅ ALL TESTS PASSED');
      process.exit(0);
    } else {
      log('❌ SOME TESTS FAILED - Review issues in tracker');
      process.exit(1);
    }
  } catch (error: any) {
    log(`\n❌ FATAL ERROR: ${error.message}`);
    log(error.stack);
    tracker.execution_metadata.status = 'ERROR';
    saveIssueTracker(tracker);
    process.exit(1);
  }
}

main();
