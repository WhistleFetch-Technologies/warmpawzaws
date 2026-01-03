/**
 * ============================================================================
 * ARTILLERY CUSTOM FUNCTIONS
 * ============================================================================
 * Helper functions for generating test data
 * ============================================================================
 */

module.exports = {
  generateCustomerPhone,
  generateVendorId,
  generateBookingDate,
  generateRandomString,
  generateRandomNumber,
};

/**
 * Generate random customer phone number
 */
function generateCustomerPhone(userContext, events, done) {
  const phone = `+9198765${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  userContext.vars.customerPhone = phone;
  return done();
}

/**
 * Generate random vendor ID
 */
function generateVendorId(userContext, events, done) {
  const vendorId = `vendor-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  userContext.vars.vendorId = vendorId;
  return done();
}

/**
 * Generate booking date (next 7 days)
 */
function generateBookingDate(userContext, events, done) {
  const today = new Date();
  const daysAhead = Math.floor(Math.random() * 7);
  const bookingDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  userContext.vars.bookingDate = bookingDate.toISOString().split('T')[0];
  return done();
}

/**
 * Generate random string
 */
function generateRandomString(userContext, events, done) {
  const strings = ['vet', 'grooming', 'training', 'vaccination', 'checkup', 'surgery'];
  userContext.vars.randomString = strings[Math.floor(Math.random() * strings.length)];
  return done();
}

/**
 * Generate random number
 */
function generateRandomNumber(userContext, events, done) {
  userContext.vars.randomNumber = Math.floor(Math.random() * 10000);
  return done();
}

/**
 * Log response for debugging
 */
function logResponse(requestParams, response, context, ee, next) {
  console.log('Response status:', response.statusCode);
  if (response.statusCode >= 400) {
    console.log('Error response:', response.body);
  }
  return next();
}

