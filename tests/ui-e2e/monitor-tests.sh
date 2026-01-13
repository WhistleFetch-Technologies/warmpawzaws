#!/bin/bash

# WARMPAWZ E2E TEST EXECUTION MONITOR
# Monitors test execution and alerts on failures

cd "$(dirname "$0")"

LOG_FILE="full-test-execution.log"
LAST_PASSED=0
LAST_FAILED=0
LAST_TEST=""

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║         WARMPAWZ E2E TEST EXECUTION - CONTINUOUS MONITOR                    ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Monitoring test execution..."
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
  clear
  
  # Check if test runner is running
  if ! ps aux | grep -E "ts-node.*test-runner" | grep -v grep > /dev/null 2>&1; then
    echo "⚠️  Test runner is not running!"
    echo "   Check the log file: $LOG_FILE"
    break
  fi
  
  # Get current stats
  PASSED=$(grep -c "passed - continuing" "$LOG_FILE" 2>/dev/null)
  FAILED=$(grep -c "failed - stopping\|stopping for fix" "$LOG_FILE" 2>/dev/null)
  BLOCKED=$(grep -c "blocked" "$LOG_FILE" 2>/dev/null)
  PASSED=${PASSED:-0}
  FAILED=${FAILED:-0}
  BLOCKED=${BLOCKED:-0}
  TOTAL=891
  EXECUTED=$((PASSED + FAILED + BLOCKED))
  REMAINING=$((TOTAL - EXECUTED))
  
  # Calculate percentage
  if [ "$TOTAL" -gt 0 ]; then
    PERCENT=$((EXECUTED * 100 / TOTAL))
  else
    PERCENT=0
  fi
  
  # Progress bar
  BAR_LEN=$((PERCENT / 2))
  if [ "$BAR_LEN" -gt 50 ]; then BAR_LEN=50; fi
  BAR=$(printf "%*s" $BAR_LEN "" | tr ' ' '█')
  EMPTY=$((50 - BAR_LEN))
  EMPTY_BAR=$(printf "%*s" $EMPTY "" | tr ' ' '░')
  
  echo "╔══════════════════════════════════════════════════════════════════════════════╗"
  echo "║         WARMPAWZ E2E TEST EXECUTION - LIVE MONITOR                          ║"
  echo "╚══════════════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📊 OVERALL PROGRESS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "   [$BAR$EMPTY_BAR] $PERCENT%"
  echo "   Executed:    $EXECUTED / $TOTAL tests"
  echo "   Remaining:   $REMAINING tests"
  echo ""
  echo "📈 TEST RESULTS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$EXECUTED" -gt 0 ]; then
    PASS_PCT=$((PASSED * 100 / EXECUTED))
    FAIL_PCT=$((FAILED * 100 / EXECUTED))
  else
    PASS_PCT=0
    FAIL_PCT=0
  fi
  echo "   ✅ Passed:       $PASSED ($PASS_PCT%)"
  echo "   ❌ Failed:       $FAILED ($FAIL_PCT%)"
  echo "   ⏸️  Blocked:      $BLOCKED"
  echo "   📊 Completed:    $EXECUTED"
  echo "   ⏳ Remaining:    $REMAINING"
  echo ""
  
  # Check for new failures
  if [ "$FAILED" -gt "$LAST_FAILED" ]; then
    echo "🚨 ALERT: NEW FAILURE DETECTED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -30 "$LOG_FILE" | grep -A 5 "failed - stopping\|stopping for fix" | tail -10
    echo ""
  fi
  
  # Check for new passes
  if [ "$PASSED" -gt "$LAST_PASSED" ]; then
    NEW_PASSES=$((PASSED - LAST_PASSED))
    echo "✅ $NEW_PASSES new test(s) passed!"
    echo ""
  fi
  
  echo "🔄 CURRENTLY EXECUTING"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  CURRENT=$(tail -20 "$LOG_FILE" 2>/dev/null | grep "🧪 Executing Test" | tail -1)
  if [ -n "$CURRENT" ]; then
    echo "   $CURRENT"
    if [ "$CURRENT" != "$LAST_TEST" ]; then
      LAST_TEST="$CURRENT"
    fi
  else
    echo "   Waiting for test execution..."
  fi
  echo ""
  
  echo "📋 RECENT RESULTS (Last 5)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  tail -30 "$LOG_FILE" 2>/dev/null | grep -E "(✅|❌|passed - continuing|failed - stopping)" | tail -5 | sed 's/^/   /' || echo "   No results yet..."
  echo ""
  
  echo "⚙️  EXECUTION STATUS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "   Status: 🟢 RUNNING"
  echo "   Mode: Serial (Fix failures before proceeding)"
  echo "   Log: $LOG_FILE"
  echo "   Updated: $(date '+%H:%M:%S')"
  echo ""
  
  # Update last counts
  LAST_PASSED=$PASSED
  LAST_FAILED=$FAILED
  
  # If failure detected, wait longer to see details
  if [ "$FAILED" -gt 0 ]; then
    sleep 5
  else
    sleep 2
  fi
done
