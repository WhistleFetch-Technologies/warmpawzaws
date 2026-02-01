#!/bin/bash

# ============================================================================
# MIGRATION 523: Orders Table - Meal Plan Delivery Columns
# ============================================================================
#
# Adds order_type, delivery_date, delivery_time, payment_method to orders
# so vendor GET /vendor/:vendorId/meal-orders sees meal_plan_delivery orders.
#
# Usage:
#   ENVIRONMENT=dev node scripts/apply-migration-523-orders-meal-plan-delivery.js
#   ./scripts/apply-migration-523-orders-meal-plan-delivery.sh
#
# Optional env: ENVIRONMENT, AWS_REGION, DB_HOST, DB_NAME, DB_SSL=true
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Migration 523: Orders Meal Plan Delivery Columns"
echo ""

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required."
  exit 1
fi

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/apply-migration-523-orders-meal-plan-delivery.js"
