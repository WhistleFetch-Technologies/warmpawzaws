/**
 * WARMPAWZ E2E TEST EXECUTION DASHBOARD
 * 
 * Real-time progress dashboard for test execution
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// DASHBOARD CONFIGURATION
// ============================================================================

const config = {
  logFile: './test-execution.log',
  resultsDir: './test-results/ui-e2e',
  reportsDir: './test-results/reports',
  updateInterval: 2000, // 2 seconds
};

// ============================================================================
// DASHBOARD
// ============================================================================

export class TestDashboard {
  private totalTests: number = 891;
  private adminTests: number = 180;
  private customerTests: number = 125;
  private vendorTests: number = 586;

  /**
   * Parse log file for test results
   */
  private parseLogFile(): {
    executed: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    currentTests: string[];
    errors: string[];
  } {
    const stats = {
      executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      currentTests: [] as string[],
      errors: [] as string[],
    };

    try {
      if (!fs.existsSync(config.logFile)) {
        return stats;
      }

      const logContent = fs.readFileSync(config.logFile, 'utf-8');
      const lines = logContent.split('\n');

      // Count test executions
      const testExecutions = logContent.match(/🧪 Executing Test:/g) || [];
      stats.executed = testExecutions.length;

      // Count passed tests
      const passedTests = logContent.match(/✅ Test PASSED:/g) || [];
      stats.passed = passedTests.length;

      // Count failed tests
      const failedTests = logContent.match(/❌ Test FAILED:/g) || [];
      const errorTests = logContent.match(/❌ Test ERROR:/g) || [];
      stats.failed = failedTests.length + errorTests.length;

      // Get current executing tests
      const currentTestMatches = logContent.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/g) || [];
      stats.currentTests = currentTestMatches
        .slice(-5) // Last 5 tests
        .map(match => {
          const matchResult = match.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/);
          return matchResult ? `${matchResult[2]}: ${matchResult[1]}` : '';
        })
        .filter(Boolean);

      // Get recent errors
      const errorLines = lines
        .filter(line => line.includes('❌') || line.includes('Error:'))
        .slice(-10);
      stats.errors = errorLines;

    } catch (error) {
      // File might not exist yet
    }

    return stats;
  }

  /**
   * Get test results from files
   */
  private getTestResults(): {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  } {
    const results = {
      total: this.totalTests,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };

    try {
      if (fs.existsSync(config.resultsDir)) {
        const files = fs.readdirSync(config.resultsDir);
        const resultFiles = files.filter(f => f.endsWith('.json'));

        for (const file of resultFiles) {
          try {
            const content = fs.readFileSync(path.join(config.resultsDir, file), 'utf-8');
            const result = JSON.parse(content);
            
            if (result.status === 'passed') results.passed++;
            else if (result.status === 'failed') results.failed++;
            else if (result.status === 'blocked') results.blocked++;
            else if (result.status === 'skipped') results.skipped++;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    return results;
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(executed: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((executed / total) * 100)) : 0;
  }

  /**
   * Create progress bar
   */
  private createProgressBar(percentage: number, width: number = 50): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + `] ${percentage}%`;
  }

  /**
   * Format time
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  /**
   * Display dashboard
   */
  display(): void {
    // Clear screen
    process.stdout.write('\x1B[2J\x1B[0f');

    const logStats = this.parseLogFile();
    const fileResults = this.getTestResults();
    
    // Use log stats for real-time, file results as fallback
    const executed = logStats.executed || fileResults.passed + fileResults.failed;
    const passed = logStats.passed || fileResults.passed;
    const failed = logStats.failed || fileResults.failed;
    const remaining = this.totalTests - executed;

    const progress = this.calculateProgress(executed, this.totalTests);
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

    // Dashboard Header
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    WARMPAWZ E2E TEST EXECUTION DASHBOARD                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    // Overall Progress
    console.log('📊 OVERALL PROGRESS');
    console.log('━'.repeat(70));
    console.log(`   ${this.createProgressBar(progress, 60)}`);
    console.log(`   Executed: ${executed} / ${this.totalTests} tests`);
    console.log(`   Remaining: ${remaining} tests\n`);

    // Test Results
    console.log('📈 TEST RESULTS');
    console.log('━'.repeat(70));
    console.log(`   ✅ Passed:    ${passed.toString().padStart(4)} (${passRate}%)`);
    console.log(`   ❌ Failed:    ${failed.toString().padStart(4)}`);
    console.log(`   ⏸️  Blocked:   ${fileResults.blocked.toString().padStart(4)}`);
    console.log(`   ⏭️  Skipped:   ${fileResults.skipped.toString().padStart(4)}`);
    console.log(`   📊 Total:     ${this.totalTests.toString().padStart(4)}\n`);

    // Test Breakdown by Role
    console.log('👥 TESTS BY ROLE');
    console.log('━'.repeat(70));
    const adminProgress = this.calculateProgress(executed * 0.2, this.adminTests); // Estimate
    const customerProgress = this.calculateProgress(executed * 0.14, this.customerTests);
    const vendorProgress = this.calculateProgress(executed * 0.66, this.vendorTests);
    
    console.log(`   👨‍💼 Admin:     ${this.createProgressBar(adminProgress, 50)} (${this.adminTests} tests)`);
    console.log(`   👤 Customer:  ${this.createProgressBar(customerProgress, 50)} (${this.customerTests} tests)`);
    console.log(`   🏪 Vendor:    ${this.createProgressBar(vendorProgress, 50)} (${this.vendorTests} tests)\n`);

    // Current Tests
    if (logStats.currentTests.length > 0) {
      console.log('🔄 CURRENTLY EXECUTING');
      console.log('━'.repeat(70));
      logStats.currentTests.forEach((test, idx) => {
        console.log(`   ${idx + 1}. ${test}`);
      });
      console.log('');
    }

    // Recent Errors
    if (logStats.errors.length > 0) {
      console.log('⚠️  RECENT ERRORS');
      console.log('━'.repeat(70));
      logStats.errors.slice(-3).forEach((error, idx) => {
        const errorMsg = error.substring(0, 65).trim();
        console.log(`   ${idx + 1}. ${errorMsg}${errorMsg.length >= 65 ? '...' : ''}`);
      });
      console.log('');
    }

    // Status
    console.log('⚙️  EXECUTION STATUS');
    console.log('━'.repeat(70));
    const status = executed < this.totalTests ? '🟢 RUNNING' : '✅ COMPLETE';
    console.log(`   Status: ${status}`);
    console.log(`   Mode: Parallel (5 concurrent)`);
    console.log(`   Retry: Enabled (3 attempts)\n`);

    // Footer
    console.log('━'.repeat(70));
    console.log('   Press Ctrl+C to stop dashboard | Auto-refresh every 2 seconds');
    console.log('━'.repeat(70));
  }

  /**
   * Start dashboard
   */
  start(): void {
    console.log('🚀 Starting test execution dashboard...\n');
    
    // Initial display
    this.display();

    // Update dashboard periodically
    const interval = setInterval(() => {
      this.display();
    }, config.updateInterval);

    // Handle exit
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n\n📊 Dashboard stopped. Test execution continues in background.\n');
      process.exit(0);
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  const dashboard = new TestDashboard();
  dashboard.start();
}
