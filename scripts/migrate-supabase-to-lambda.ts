/**
 * Migration Utility: Supabase Functions to AWS Lambda
 * 
 * This script helps automate the migration of Supabase Functions to Lambda handlers
 * by providing templates and checking for common patterns
 */

interface MigrationMapping {
  supabasePath: string;
  lambdaPath: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  dependencies: string[];
}

const MIGRATION_MAP: MigrationMapping[] = [
  // Critical - Authentication & Core
  {
    supabasePath: 'supabase/functions/make-server-core/auth-endpoints.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/auth.ts',
    priority: 'critical',
    status: 'completed',
    dependencies: [],
  },
  {
    supabasePath: 'supabase/functions/make-server-vendor/vendor-onboarding.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/vendor-onboarding.ts',
    priority: 'critical',
    status: 'completed',
    dependencies: [],
  },
  
  // High Priority - Bookings & Payments
  {
    supabasePath: 'supabase/functions/make-server-booking/booking-endpoints.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/bookings.ts',
    priority: 'high',
    status: 'pending',
    dependencies: ['auth'],
  },
  {
    supabasePath: 'supabase/functions/make-server-payment/payment-endpoints.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/payments.ts',
    priority: 'high',
    status: 'pending',
    dependencies: ['auth'],
  },
  
  // High Priority - Vendor Management
  {
    supabasePath: 'supabase/functions/make-server-vendor/vendor-role-config.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/roles.ts',
    priority: 'high',
    status: 'pending',
    dependencies: [],
  },
  {
    supabasePath: 'supabase/functions/make-server-vendor/vendor-dashboard-endpoints.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/vendor-dashboard.ts',
    priority: 'high',
    status: 'pending',
    dependencies: ['auth'],
  },
  
  // Medium Priority - Customer Routes
  {
    supabasePath: 'supabase/functions/make-server-customer/customer-routes.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/customer.ts',
    priority: 'medium',
    status: 'pending',
    dependencies: ['auth'],
  },
  
  // Medium Priority - Admin Routes
  {
    supabasePath: 'supabase/functions/make-server-admin/admin-vendor-routes.tsx',
    lambdaPath: 'backend/lambda/src/endpoints/admin-vendors.ts',
    priority: 'medium',
    status: 'pending',
    dependencies: ['auth'],
  },
];

export function getMigrationStatus(): MigrationMapping[] {
  return MIGRATION_MAP;
}

export function getPendingMigrations(): MigrationMapping[] {
  return MIGRATION_MAP.filter(m => m.status === 'pending');
}

export function getCriticalMigrations(): MigrationMapping[] {
  return MIGRATION_MAP.filter(m => m.priority === 'critical' && m.status !== 'completed');
}

export { MigrationMapping };

