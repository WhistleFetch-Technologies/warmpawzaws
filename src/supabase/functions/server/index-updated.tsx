/**
 * UPDATED SERVER INDEX
 * 
 * Complete integration of Priority 1 & Priority 2 features
 * Copy this content to your actual /supabase/functions/server/index.tsx
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';

// ✅ PRIORITY 1: Critical Features (NEW)
import instantTeleRoutes from './instant-tele-booking.tsx';
import scheduledTeleRoutes from './scheduled-tele-booking.tsx';
import standardizedOtpRoutes from './standardized-otp-endpoints.tsx';

// ✅ PRIORITY 2: Enhancements (NEW)
import enhancedServicePublishing from './enhanced-service-publishing.tsx';
import enhancedStaffAvailability from './enhanced-staff-availability-with-conflicts.tsx';
import enhancedGpsTracking from './enhanced-gps-tracking.tsx';
import homeServiceAutoAssignment from './home-service-auto-assignment.tsx';

// ⚠️ EXISTING IMPORTS (keep these - commented out to show structure)
// import bookingRoutes from './booking-endpoints.tsx';
// import vendorRoutes from './vendor-service-management.tsx';
// import roleConfigRoutes from './role-config-endpoints.tsx';
// import staffRoutes from './staff-availability-routes.tsx';
// import groomingRoutes from './grooming-booking-apis.tsx';
// import homeServicesRoutes from './home-services-endpoints.tsx';
// import packageRoutes from './package-milestone-endpoints.tsx';
// import gpsRoutes from './gps-tracking.tsx';
// ... add all your existing imports here

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Health check
app.get('/make-server-3dd53475/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0',
    features: {
      instantTele: true,
      scheduledTele: true,
      standardizedOtp: true,
      enhancedServicePublishing: true,
      enhancedStaffAvailability: true,
      enhancedGpsTracking: true,
      homeServiceAutoAssignment: true
    }
  });
});

// ========================================
// ✅ PRIORITY 1: CRITICAL FEATURES (NEW)
// ========================================

app.route('/make-server-3dd53475', instantTeleRoutes);
app.route('/make-server-3dd53475', scheduledTeleRoutes);
app.route('/make-server-3dd53475', standardizedOtpRoutes);

// ========================================
// ✅ PRIORITY 2: ENHANCEMENTS (NEW)
// ========================================

app.route('/make-server-3dd53475', enhancedServicePublishing);
app.route('/make-server-3dd53475', enhancedStaffAvailability);
app.route('/make-server-3dd53475', enhancedGpsTracking);
app.route('/make-server-3dd53475', homeServiceAutoAssignment);

// ========================================
// ⚠️ EXISTING ROUTES (uncomment these)
// ========================================

// app.route('/make-server-3dd53475', bookingRoutes);
// app.route('/make-server-3dd53475', vendorRoutes);
// app.route('/make-server-3dd53475', roleConfigRoutes);
// app.route('/make-server-3dd53475', staffRoutes);
// app.route('/make-server-3dd53475', groomingRoutes);
// app.route('/make-server-3dd53475', homeServicesRoutes);
// app.route('/make-server-3dd53475', packageRoutes);
// app.route('/make-server-3dd53475', gpsRoutes);
// ... mount all your existing routes

// ========================================
// 404 Handler
// ========================================

app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method,
    message: 'The requested endpoint does not exist'
  }, 404);
});

// ========================================
// Error Handler
// ========================================

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// Start server
Deno.serve(app.fetch);

console.log('🚀 Warmpawz Server started');
console.log('✅ Priority 1 features loaded: Instant Tele, Scheduled Tele, OTP');
console.log('✅ Priority 2 features loaded: Service Publishing, Staff Availability, GPS, Home Assignment');
