#!/usr/bin/env node
/**
 * Sanity check for notification campaign engine on PRODUCTION API.
 * Usage: node scripts/sanity-check-notification-engine-prod.js
 */
process.env.API_BASE_URL =
  process.env.API_BASE_URL || 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

require('./sanity-check-notification-engine-dev.js');
