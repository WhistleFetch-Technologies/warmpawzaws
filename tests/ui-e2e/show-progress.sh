#!/bin/bash

# WARMPAWZ E2E TEST EXECUTION - LIVE PROGRESS DASHBOARD

cd "$(dirname "$0")"

while true; do
  clear
  echo "╔══════════════════════════════════════════════════════════════════════════════╗"
  echo "║              WARMPAWZ E2E TEST EXECUTION - LIVE PROGRESS                    ║"
  echo "╚══════════════════════════════════════════════════════════════════════════════╝"
  echo ""
  
  # Calculate progress
  TOTAL=891
  PASSED=$(grep -c "✅ Test.*passed\|PASSED" full-test-execution.log 2>/dev/null || echo "0")
  FAILED=$(grep -c "❌ Test.*failed\|FAILED" full-test-execution.log 2>/dev/null || echo "0")
  BLOCKED=$(grep -c "blocked" full-test-execution.log 2>/dev/null || echo "0")
  EXECUTED=$((PASSED + FAILED + BLOCKED))
  REMAINING=$((TOTAL - EXECUTED))
  
  if [ "$TOTAL" -gt 0 ]; then
    PERCENT=$((EXECUTED * 100 / TOTAL))
  else
    PERCENT=0
  fi
  
  # Progress bar
  BAR_LEN=$((PERCENT / 2))
  if [ "$BAR_LEN" -gt 50 ]; then
    BAR_LEN=50
  fi
  BAR=$(printf "%*s" $BAR_LEN "" | tr ' ' '█')
  EMPTY=$((50 - BAR_LEN))
  EMPTY_BAR=$(printf "%*s" $EMPTY "" | tr ' ' '░')
  
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
  
  echo "🔄 CURRENTLY EXECUTING"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  CURRENT=$(tail -20 full-test-execution.log 2>/dev/null | grep -E "🧪 Executing Test" | tail -1 | sed 's/^[[:space:]]*//')
  if [ -n "$CURRENT" ]; then
    echo "   $CURRENT"
  else
    echo "   Waiting for test execution..."
  fi
  echo ""
  
  echo "📋 RECENT RESULTS (Last 5)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  tail -30 full-test-execution.log 2>/dev/null | grep -E "(✅|❌|PASSED|FAILED|passed - continuing)" | tail -5 | sed 's/^/   /' || echo "   No results yet..."
  echo ""
  
  echo "⚙️  EXECUTION STATUS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if ps aux | grep -E "ts-node.*test-runner" | grep -v grep > /dev/null 2>&1; then
    echo "   Status: 🟢 RUNNING"
  else
    echo "   Status: 🔴 STOPPED"
  fi
  echo "   Mode: Serial (Fix failures before proceeding)"
  echo "   Log: full-test-execution.log"
  echo ""
  echo "   Last updated: $(date '+%H:%M:%S')"
  echo ""
  echo "   Press Ctrl+C to exit"
  
  sleep 2
done
