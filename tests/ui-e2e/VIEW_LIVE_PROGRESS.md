# 🎯 VIEW LIVE TEST PROGRESS

## 🚀 Quick Start

### Start Live Dashboard
```bash
cd tests/ui-e2e
npm run live
```

The dashboard will show:
- ✅ **Progress Bar** - Visual progress indicator
- ✅ **Current Test** - What test is being executed right now
- ✅ **Passed Count** - How many tests passed
- ✅ **Failed Count** - How many tests failed
- ✅ **Remaining** - How many tests left to execute

## 📊 Dashboard Features

### Real-Time Updates
- Auto-refreshes every 2 seconds
- Shows currently executing tests
- Displays pass/fail statistics
- Shows recent errors
- Visual progress bar

### Information Displayed
1. **Overall Progress**
   - Progress bar (0-100%)
   - Executed / Total tests
   - Remaining tests count

2. **Test Results**
   - Passed count and percentage
   - Failed count and percentage
   - Completed vs Remaining

3. **Currently Executing**
   - Last 5 tests being executed
   - Test ID and name
   - Real-time status

4. **Recent Errors**
   - Last 3 errors encountered
   - Quick error visibility

5. **Execution Status**
   - Current status (RUNNING/COMPLETE)
   - Execution mode
   - Configuration details

## 🎯 Example Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              WARMPAWZ E2E TEST EXECUTION - LIVE PROGRESS DASHBOARD          ║
╚══════════════════════════════════════════════════════════════════════════════╝

📊 OVERALL PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 2%
   Executed:   18 / 891 tests
   Remaining: 873 tests

📈 TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Passed:       0 (0%)
   ❌ Failed:      13 (72%)
   📊 Completed:   13
   ⏳ Remaining:  878

🔄 CURRENTLY EXECUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    1. [admin-051] Configure Cancellation Policy
    2. [admin-055] Manual Settlement Override
    3. [admin-050] Configure Refund Policy
    4. [admin-052] Configure GST Slabs
    5. [admin-053] Configure Commission Tiers
```

## ⚙️ Commands

- **Live Dashboard:** `npm run live`
- **One-time View:** `npm run progress`
- **Watch Mode:** `npm run watch`

---

**Run `npm run live` to see real-time progress!**
