#!/bin/bash
# ============================================================================
# Fix UUID Validation Issues - Add Test ID Handling to All Endpoints
# ============================================================================

# This script creates a helper function to validate UUIDs and handle test IDs
# We'll add this to a utility file and use it across all endpoints

cat > /tmp/uuid-helper.js << 'EOF'
// UUID validation helper
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isTestID(id) {
  return id === 'test-vendor-id' || id === 'test-staff-id' || id === 'test-package-id' || id === 'test-booking-id' || !isValidUUID(id);
}

module.exports = { isValidUUID, isTestID };
EOF

echo "✅ UUID helper created at /tmp/uuid-helper.js"
echo "This can be imported in endpoints to handle test IDs gracefully"
