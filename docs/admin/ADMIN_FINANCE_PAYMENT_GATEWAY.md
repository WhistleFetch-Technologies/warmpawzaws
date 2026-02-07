# Payment Gateway & Payment Rules – Admin Guide

## What is the Payment Gateway Screen?

The Payment Gateway screen (Finance → Payment Gateway) configures **payment gateways** (e.g. Razorpay), **general refund settings**, **payment rules** (advance, escrow, vendor-type rules), **refund policies** (tiers by hours before service), and **settlement schedule**. It is the central place for how customers pay and how refunds and settlements are configured.

---

## Tabs Overview

| Tab | Purpose |
|-----|---------|
| **General** | Enable/disable refunds, auto-reconcile, reconcile period (days). |
| **Gateway** | Add/edit payment gateways (name, type, Key ID, Key Secret, Webhook Secret, enabled). |
| **Payment Rules** | Same as Finance → Payment Policies: advance amount, escrow, grace period, vendor types, service location. |
| **Refund Policies** | Same as Finance → Refund Policies: refund tiers by hours before service, vendor types, service location. |
| **Schedule** | Same as Schedule Settings: when settlements run (daily/weekly/monthly, time, timezone, min payout, Process Now). |

---

## How to Configure

**General**
- **Enable Refunds** – Allow customers to request refunds.
- **Auto Reconcile** – Automatically reconcile refunds after the reconcile period.
- **Reconcile Period (days)** – How many days after a refund to reconcile (for accounting).

**Gateway**
- Click **Add Gateway** (or edit existing). Enter **Name**, **Type** (e.g. Razorpay), **Key ID**, **Key Secret**, **Webhook Secret**. **Enabled** = use this gateway for charges and payouts.
- Save gateway config (Razorpay keys) so the platform can create orders and capture payments.

**Payment Rules**
- Create or edit rules: vendor types, service location, reservation type (flat/percentage/full), advance amount, escrow period, grace period, partial payment, auto capture, etc. Same behaviour as **Finance → Payment Policies**; see that help for full option impact.

**Refund Policies**
- Create or edit refund tiers: vendor types, service location, hours before service, refund %, cancellation fee. Same as **Finance → Refund Policies**; see that help for full option impact.

**Schedule**
- Configure settlement schedule (enable, type, day, time, period, auto process, min payout, timezone). Same as **Schedule Settings**; see that help for full option impact.

---

## Where Payment Gateway Settings Are Used

| Where | How |
|-------|-----|
| **Customer checkout** | Gateway keys and Payment Rules determine which gateway is used and how much advance is collected. |
| **Refunds** | Refund Policies and General (enable refunds, reconcile) control refund eligibility and reconciliation. |
| **Settlement run** | Schedule tab controls when settlement jobs run. |
| **Payouts** | Gateway (e.g. Razorpay) is used to send payouts to vendors if you use gateway-based transfers. |

---

## Option Impact Summary

| Area | Key options | Impacts |
|------|-------------|---------|
| **General** | Enable Refunds, Auto Reconcile, Reconcile Period | Whether refunds are allowed and how reconciliation is done. |
| **Gateway** | Key ID, Key Secret, Webhook Secret, Enabled | Which gateway is used for payments and payouts; webhook for async events. |
| **Payment Rules** | See Payment Policies help | Advance, escrow, grace period, vendor/service scope. |
| **Refund Policies** | See Refund Policies help | Refund % by hours before service, vendor/service scope. |
| **Schedule** | See Schedule Settings help | When settlements run, period, auto process, min payout. |

---

## Tips

- Keep **Key Secret** and **Webhook Secret** secure; they are used for server-side API calls and webhook verification.
- **Payment Rules** and **Refund Policies** here are the same as under Finance; changing them in one place updates the other.
- Use **Schedule** to align settlement runs with your finance calendar (e.g. weekly on Monday 9 AM).
