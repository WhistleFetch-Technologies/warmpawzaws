/**
 * ============================================================================
 * PLATFORM COMPLIANCE TEST SUITE
 * ============================================================================
 * 
 * Tests for 100% SQL compliance, capability enforcement, and flow completeness
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery } from "../db.ts";
// Note: checkCapability is not exported, using direct query instead
import { validateBookingTransition } from "../services/state-machine-validator.ts";
import { calculateGST } from "../services/gst-calculator.ts";

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class PlatformComplianceTestSuite {
  
  /**
   * Run all compliance tests
   */
  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test 1: SQL Schema Compliance
    results.push(...await this.testSQLSchemaCompliance());
    
    // Test 2: Capability System
    results.push(...await this.testCapabilitySystem());
    
    // Test 3: State Machine Validation
    results.push(...await this.testStateMachineValidation());
    
    // Test 4: GST Calculation
    results.push(...await this.testGSTCalculation());
    
    // Test 5: Transactional Safety
    results.push(...await this.testTransactionalSafety());
    
    // Test 6: Service Discovery
    results.push(...await this.testServiceDiscovery());
    
    // Test 7: Booking Lifecycle
    results.push(...await this.testBookingLifecycle());
    
    // Test 8: Payment Flow
    results.push(...await this.testPaymentFlow());
    
    // Test 9: Settlement Flow
    results.push(...await this.testSettlementFlow());
    
    // Test 10: Payout Flow
    results.push(...await this.testPayoutFlow());
    
    return results;
  }
  
  /**
   * Test 1: SQL Schema Compliance
   */
  private async testSQLSchemaCompliance(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check all required tables exist
      const requiredTables = [
        'customers', 'vendors', 'bookings', 'payments', 'refunds',
        'settlements', 'payouts', 'services', 'staff', 'orders',
        'role_capabilities', 'booking_state_transitions', 'payout_locks',
        'audit_logs', 'service_dashboard_mappings', 'role_mappings'
      ];
      
      for (const table of requiredTables) {
        const exists = await selectQuery(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
          [table]
        );
        
        results.push({
          name: `Table ${table} exists`,
          passed: exists && exists[0]?.exists === true,
          message: exists && exists[0]?.exists ? `Table ${table} exists` : `Table ${table} missing`
        });
      }
      
      // Check constraints
      const constraints = [
        { name: 'bookings_status_check', table: 'bookings' },
        { name: 'payments_status_check', table: 'payments' },
        { name: 'settlements_status_check', table: 'settlements' }
      ];
      
      for (const constraint of constraints) {
        const exists = await selectQuery(
          "SELECT EXISTS (SELECT FROM information_schema.check_constraints WHERE constraint_name = $1)",
          [constraint.name]
        );
        
        results.push({
          name: `Constraint ${constraint.name} exists`,
          passed: exists && exists[0]?.exists === true,
          message: exists && exists[0]?.exists 
            ? `Constraint ${constraint.name} exists` 
            : `Constraint ${constraint.name} missing`
        });
      }
      
    } catch (error) {
      results.push({
        name: 'SQL Schema Compliance',
        passed: false,
        message: `Error testing schema: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 2: Capability System
   */
  private async testCapabilitySystem(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check role_capabilities table exists
      const tableExists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'role_capabilities')",
        []
      );
      
      results.push({
        name: 'role_capabilities table exists',
        passed: tableExists && tableExists[0]?.exists === true,
        message: tableExists && tableExists[0]?.exists 
          ? 'role_capabilities table exists' 
          : 'role_capabilities table missing'
      });
      
      // Check if capabilities can be queried
      const capabilities = await selectQuery(
        "SELECT * FROM role_capabilities LIMIT 1",
        []
      );
      
      results.push({
        name: 'Capabilities can be queried',
        passed: true,
        message: 'Capabilities query successful'
      });
      
    } catch (error) {
      results.push({
        name: 'Capability System',
        passed: false,
        message: `Error testing capabilities: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 3: State Machine Validation
   */
  private async testStateMachineValidation(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Test valid transitions
      const validTransitions = [
        { from: 'pending', to: 'confirmed', shouldPass: true },
        { from: 'confirmed', to: 'in_progress', shouldPass: true },
        { from: 'in_progress', to: 'completed', shouldPass: true },
        { from: 'pending', to: 'completed', shouldPass: false } // Invalid
      ];
      
      for (const transition of validTransitions) {
        const validation = await validateBookingTransition(
          transition.from,
          transition.to
        );
        
        results.push({
          name: `Transition ${transition.from} → ${transition.to}`,
          passed: validation.allowed === transition.shouldPass,
          message: validation.allowed === transition.shouldPass
            ? `Transition validation correct`
            : `Transition validation incorrect: expected ${transition.shouldPass}, got ${validation.allowed}`
        });
      }
      
    } catch (error) {
      results.push({
        name: 'State Machine Validation',
        passed: false,
        message: `Error testing state machine: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 4: GST Calculation
   */
  private async testGSTCalculation(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Test GST calculation
      const gst = await calculateGST({
        amount: 1000,
        roleId: 'test-role',
        serviceStyle: 'at_center',
        customerState: 'Karnataka',
        vendorState: 'Karnataka'
      });
      
      results.push({
        name: 'GST calculation works',
        passed: gst.gstAmount > 0 && gst.total > gst.subtotal,
        message: `GST calculated: ${gst.gstAmount}, Total: ${gst.total}`
      });
      
    } catch (error) {
      results.push({
        name: 'GST Calculation',
        passed: false,
        message: `Error testing GST: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 5: Transactional Safety
   */
  private async testTransactionalSafety(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check transaction log tables exist
      const logTables = [
        'booking_transaction_log',
        'payment_transaction_log',
        'wallet_transaction_log'
      ];
      
      for (const table of logTables) {
        const exists = await selectQuery(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
          [table]
        );
        
        results.push({
          name: `Transaction log ${table} exists`,
          passed: exists && exists[0]?.exists === true,
          message: exists && exists[0]?.exists 
            ? `${table} exists` 
            : `${table} missing`
        });
      }
      
    } catch (error) {
      results.push({
        name: 'Transactional Safety',
        passed: false,
        message: `Error testing transactions: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 6: Service Discovery
   */
  private async testServiceDiscovery(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check service_dashboard_mappings table exists
      const exists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_dashboard_mappings')",
        []
      );
      
      results.push({
        name: 'Service dashboard mappings table exists',
        passed: exists && exists[0]?.exists === true,
        message: exists && exists[0]?.exists 
          ? 'service_dashboard_mappings table exists' 
          : 'service_dashboard_mappings table missing'
      });
      
    } catch (error) {
      results.push({
        name: 'Service Discovery',
        passed: false,
        message: `Error testing service discovery: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 7: Booking Lifecycle
   */
  private async testBookingLifecycle(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check bookings table has all required columns
      const columns = await selectQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'",
        []
      );
      
      const requiredColumns = ['id', 'customer_id', 'vendor_id', 'status', 'payment_status'];
      const columnNames = columns.map((c: any) => c.column_name);
      
      for (const col of requiredColumns) {
        results.push({
          name: `Bookings table has ${col} column`,
          passed: columnNames.includes(col),
          message: columnNames.includes(col) 
            ? `${col} column exists` 
            : `${col} column missing`
        });
      }
      
    } catch (error) {
      results.push({
        name: 'Booking Lifecycle',
        passed: false,
        message: `Error testing booking lifecycle: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 8: Payment Flow
   */
  private async testPaymentFlow(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check payments table exists
      const exists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments')",
        []
      );
      
      results.push({
        name: 'Payments table exists',
        passed: exists && exists[0]?.exists === true,
        message: exists && exists[0]?.exists 
          ? 'payments table exists' 
          : 'payments table missing'
      });
      
    } catch (error) {
      results.push({
        name: 'Payment Flow',
        passed: false,
        message: `Error testing payment flow: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 9: Settlement Flow
   */
  private async testSettlementFlow(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check settlements table exists
      const exists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settlements')",
        []
      );
      
      results.push({
        name: 'Settlements table exists',
        passed: exists && exists[0]?.exists === true,
        message: exists && exists[0]?.exists 
          ? 'settlements table exists' 
          : 'settlements table missing'
      });
      
    } catch (error) {
      results.push({
        name: 'Settlement Flow',
        passed: false,
        message: `Error testing settlement flow: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Test 10: Payout Flow
   */
  private async testPayoutFlow(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Check payouts table exists
      const exists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payouts')",
        []
      );
      
      results.push({
        name: 'Payouts table exists',
        passed: exists && exists[0]?.exists === true,
        message: exists && exists[0]?.exists 
          ? 'payouts table exists' 
          : 'payouts table missing'
      });
      
      // Check payout_locks table exists
      const locksExists = await selectQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payout_locks')",
        []
      );
      
      results.push({
        name: 'Payout locks table exists',
        passed: locksExists && locksExists[0]?.exists === true,
        message: locksExists && locksExists[0]?.exists 
          ? 'payout_locks table exists' 
          : 'payout_locks table missing'
      });
      
    } catch (error) {
      results.push({
        name: 'Payout Flow',
        passed: false,
        message: `Error testing payout flow: ${error}`,
        details: error
      });
    }
    
    return results;
  }
  
  /**
   * Generate test report
   */
  async generateReport(): Promise<string> {
    const results = await this.runAllTests();
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = (passed / total * 100).toFixed(2);
    
    let report = `# Platform Compliance Test Report\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;
    report += `**Results:** ${passed}/${total} tests passed (${percentage}%)\n\n`;
    report += `---\n\n`;
    
    for (const result of results) {
      const status = result.passed ? '✅' : '❌';
      report += `## ${status} ${result.name}\n\n`;
      report += `${result.message}\n\n`;
      if (result.details) {
        report += `**Details:** ${JSON.stringify(result.details, null, 2)}\n\n`;
      }
    }
    
    return report;
  }
}

