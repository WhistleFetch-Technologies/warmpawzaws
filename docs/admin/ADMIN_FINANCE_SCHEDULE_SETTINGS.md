# Schedule Settings – Admin Guide

## What are Schedule Settings?

Schedule Settings control **when and how often settlements are run** and **when payouts can be processed**. You set a **schedule type** (daily, weekly, biweekly, monthly), **day and time**, **timezone**, **minimum payout amount**, and whether to **auto-process** settlements. You can also trigger **Process Now** to run a settlement cycle manually.

---

## How to Configure Schedule Settings

1. Go to **Finance & Logistics** → **Schedule Settings** (or open from Payment Gateway tab if embedded there).
2. Configure:
   - **Enable / Disable** – Turn the settlement schedule on or off.
   - **Schedule Type** – Daily, Weekly, Biweekly, or Monthly.
   - **Schedule Day** – For weekly/biweekly/monthly: which day (e.g. 1 = Monday, 7 = Sunday).
   - **Schedule Time** – Time of day (e.g. 09:00) in the selected timezone.
   - **Settlement Period (days)** – How many days of transactions are included in each run (e.g. 7 for last 7 days).
   - **Auto Process** – If enabled, settlements are automatically moved to processable state (or processed, depending on implementation).
   - **Minimum Payout Amount (₹)** – Vendors with balance below this may not get a payout in that cycle (optional behaviour).
   - **Timezone** – Timezone for schedule time (e.g. Asia/Kolkata).
3. Click **Save**.
4. Use **Process Now** to run a settlement cycle immediately (without waiting for the next scheduled time).

---

## Where Schedule Settings Are Used

| Where | How |
|-------|-----|
| **Settlement run** | A cron or scheduler uses these settings to trigger the settlement job at the configured day/time. |
| **Settlements dashboard** | Shows last processed and next run (if displayed). |
| **Payout Management** | After settlements are generated, payouts can be processed from Payout Management; schedule does not directly send money but controls when new settlement records are created. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Enabled** | When off, no automatic settlement runs; you can still use Process Now. |
| **Schedule Type** | How often the job runs: daily, weekly, biweekly, monthly. |
| **Schedule Day** | For non-daily: which day of the week or month the run happens. |
| **Schedule Time** | Time of day (in configured timezone) when the run executes. |
| **Settlement Period (days)** | Number of days of transactions included in each run (e.g. 7 = last week). |
| **Auto Process** | Whether to auto-advance or auto-process settlements after the run. |
| **Min Payout Amount** | Can be used to skip payouts below a threshold (implementation-dependent). |
| **Process Now** | Runs one settlement cycle immediately. |

---

## Tips

- Set **Schedule Time** outside peak hours so reports and payouts don’t conflict with live traffic.
- Use **Settlement Period** to match your business (e.g. 7 days for weekly, 30 for monthly).
- **Process Now** is useful for ad-hoc runs or testing; normal operation relies on the schedule.
