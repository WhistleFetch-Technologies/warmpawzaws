#!/bin/bash

# Session Management & Authentication Test Suite
# Tests all logout flows, token expiry, and session persistence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${SUPABASE_PROJECT_ID:-vpvpbdwtyugbknrntkho}"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM}"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
    ((TOTAL++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
    ((TOTAL++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    log_info "Testing: $name"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${ANON_KEY}" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${ANON_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        log_success "$name (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        log_error "$name (Expected: $expected_status, Got: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Test data
TEST_PHONE="9876543210"
TEST_ADMIN_EMAIL="admin@warmpawz.com"
TEST_ADMIN_PASSWORD="warmpawz2025"

echo ""
echo "=========================================="
echo "  Session Management Test Suite"
echo "=========================================="
echo ""

# ============================================
# 1. Test Device Detection in Login
# ============================================
echo ""
echo "📱 Testing Device Detection in Login"
echo "-----------------------------------"

# Test mobile app login
log_info "Testing mobile app login (should get 365 days expiry)"
MOBILE_LOGIN_RESPONSE=$(curl -s -X POST \
    "${BASE_URL}/auth/login" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"phone\": \"${TEST_PHONE}\",
        \"portal\": \"customer\",
        \"deviceType\": \"mobile\",
        \"isMobileApp\": true
    }")

if echo "$MOBILE_LOGIN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    EXPIRES_AT=$(echo "$MOBILE_LOGIN_RESPONSE" | jq -r '.data.session.expiresAt // .data.supabaseTokens.expiresAt')
    if [ "$EXPIRES_AT" != "null" ] && [ -n "$EXPIRES_AT" ]; then
        EXPIRY_DATE=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${EXPIRES_AT%Z}" "+%s" 2>/dev/null || date -d "${EXPIRES_AT}" "+%s" 2>/dev/null)
        NOW=$(date "+%s")
        DAYS_DIFF=$(( ($EXPIRY_DATE - $NOW) / 86400 ))
        
        if [ $DAYS_DIFF -ge 360 ] && [ $DAYS_DIFF -le 370 ]; then
            log_success "Mobile app login - Token expiry ~365 days (${DAYS_DIFF} days)"
        else
            log_error "Mobile app login - Expected ~365 days, got ${DAYS_DIFF} days"
        fi
    else
        log_error "Mobile app login - No expiry date in response"
    fi
else
    log_error "Mobile app login - Request failed"
    echo "$MOBILE_LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$MOBILE_LOGIN_RESPONSE"
fi

# Test web customer login
log_info "Testing web customer login (should get 48 hours expiry)"
WEB_LOGIN_RESPONSE=$(curl -s -X POST \
    "${BASE_URL}/auth/login" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"phone\": \"${TEST_PHONE}\",
        \"portal\": \"customer\",
        \"deviceType\": \"web\",
        \"isMobileApp\": false
    }")

if echo "$WEB_LOGIN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    EXPIRES_AT=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.session.expiresAt // .data.supabaseTokens.expiresAt')
    if [ "$EXPIRES_AT" != "null" ] && [ -n "$EXPIRES_AT" ]; then
        EXPIRY_DATE=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${EXPIRES_AT%Z}" "+%s" 2>/dev/null || date -d "${EXPIRES_AT}" "+%s" 2>/dev/null)
        NOW=$(date "+%s")
        HOURS_DIFF=$(( ($EXPIRY_DATE - $NOW) / 3600 ))
        
        if [ $HOURS_DIFF -ge 47 ] && [ $HOURS_DIFF -le 49 ]; then
            log_success "Web customer login - Token expiry ~48 hours (${HOURS_DIFF} hours)"
        else
            log_error "Web customer login - Expected ~48 hours, got ${HOURS_DIFF} hours"
        fi
    else
        log_error "Web customer login - No expiry date in response"
    fi
else
    log_error "Web customer login - Request failed"
    echo "$WEB_LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$WEB_LOGIN_RESPONSE"
fi

# ============================================
# 2. Test Session Creation with Device Info
# ============================================
echo ""
echo "🔐 Testing Session Creation"
echo "---------------------------"

# Get session from login
SESSION_ID=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.session.sessionId // empty')
USER_ID=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.session.userId // empty')
ACCESS_TOKEN=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.session.accessToken // empty')

if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    log_success "Session created with ID: ${SESSION_ID:0:20}..."
else
    log_error "Session creation failed - No session ID"
fi

# ============================================
# 3. Test Session Verification
# ============================================
echo ""
echo "✅ Testing Session Verification"
echo "-------------------------------"

if [ -n "$SESSION_ID" ]; then
    test_endpoint \
        "Verify session" \
        "POST" \
        "/auth/verify-session" \
        "{\"sessionId\": \"${SESSION_ID}\"}" \
        "200"
fi

# ============================================
# 4. Test Logout Functionality
# ============================================
echo ""
echo "👋 Testing Logout Functionality"
echo "-------------------------------"

# Test logout by sessionId
if [ -n "$SESSION_ID" ]; then
    test_endpoint \
        "Logout by sessionId" \
        "POST" \
        "/auth/logout" \
        "{\"sessionId\": \"${SESSION_ID}\"}" \
        "200"
fi

# Test logout by userId
if [ -n "$USER_ID" ]; then
    # Create new session first
    NEW_SESSION_RESPONSE=$(curl -s -X POST \
        "${BASE_URL}/auth/login" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"phone\": \"${TEST_PHONE}\",
            \"portal\": \"customer\",
            \"deviceType\": \"web\"
        }")
    
    NEW_USER_ID=$(echo "$NEW_SESSION_RESPONSE" | jq -r '.data.session.userId // empty')
    
    if [ -n "$NEW_USER_ID" ]; then
        test_endpoint \
            "Logout by userId" \
            "POST" \
            "/auth/logout" \
            "{\"userId\": \"${NEW_USER_ID}\"}" \
            "200"
    fi
fi

# Test logout by accessToken
if [ -n "$ACCESS_TOKEN" ]; then
    # Create new session first
    NEW_SESSION_RESPONSE=$(curl -s -X POST \
        "${BASE_URL}/auth/login" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"phone\": \"${TEST_PHONE}\",
            \"portal\": \"customer\",
            \"deviceType\": \"web\"
        }")
    
    NEW_ACCESS_TOKEN=$(echo "$NEW_SESSION_RESPONSE" | jq -r '.data.session.accessToken // empty')
    NEW_SUPABASE_TOKEN=$(echo "$NEW_SESSION_RESPONSE" | jq -r '.data.supabaseTokens.accessToken // empty')
    
    if [ -n "$NEW_ACCESS_TOKEN" ] || [ -n "$NEW_SUPABASE_TOKEN" ]; then
        TOKEN_TO_USE="${NEW_SUPABASE_TOKEN:-$NEW_ACCESS_TOKEN}"
        test_endpoint \
            "Logout by accessToken" \
            "POST" \
            "/auth/logout" \
            "{\"accessToken\": \"${TOKEN_TO_USE}\"}" \
            "200"
    fi
fi

# Test logout all devices
if [ -n "$USER_ID" ]; then
    # Create new session first
    NEW_SESSION_RESPONSE=$(curl -s -X POST \
        "${BASE_URL}/auth/login" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"phone\": \"${TEST_PHONE}\",
            \"portal\": \"customer\",
            \"deviceType\": \"web\"
        }")
    
    NEW_USER_ID=$(echo "$NEW_SESSION_RESPONSE" | jq -r '.data.session.userId // empty')
    
    if [ -n "$NEW_USER_ID" ]; then
        test_endpoint \
            "Logout from all devices" \
            "POST" \
            "/auth/logout" \
            "{\"userId\": \"${NEW_USER_ID}\", \"logoutAll\": true}" \
            "200"
    fi
fi

# ============================================
# 5. Test Token Expiry Validation
# ============================================
echo ""
echo "⏰ Testing Token Expiry Validation"
echo "-----------------------------------"

# Create a session and verify it's valid
VALID_SESSION_RESPONSE=$(curl -s -X POST \
    "${BASE_URL}/auth/login" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"phone\": \"${TEST_PHONE}\",
        \"portal\": \"customer\",
        \"deviceType\": \"web\"
    }")

VALID_SESSION_ID=$(echo "$VALID_SESSION_RESPONSE" | jq -r '.data.session.sessionId // empty')

if [ -n "$VALID_SESSION_ID" ]; then
    # Verify session is valid
    VERIFY_RESPONSE=$(curl -s -X POST \
        "${BASE_URL}/auth/verify-session" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"sessionId\": \"${VALID_SESSION_ID}\"}")
    
    if echo "$VERIFY_RESPONSE" | jq -e '.data.valid == true' > /dev/null 2>&1; then
        log_success "Valid session verification"
    else
        log_error "Session verification failed for valid session"
    fi
fi

# ============================================
# 6. Test Supabase Token Generation
# ============================================
echo ""
echo "🔑 Testing Supabase Token Generation"
echo "-------------------------------------"

if echo "$WEB_LOGIN_RESPONSE" | jq -e '.data.supabaseTokens' > /dev/null 2>&1; then
    SUPABASE_ACCESS_TOKEN=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.supabaseTokens.accessToken // empty')
    SUPABASE_REFRESH_TOKEN=$(echo "$WEB_LOGIN_RESPONSE" | jq -r '.data.supabaseTokens.refreshToken // empty')
    
    if [ -n "$SUPABASE_ACCESS_TOKEN" ] && [ "$SUPABASE_ACCESS_TOKEN" != "null" ]; then
        log_success "Supabase access token generated"
    else
        log_error "Supabase access token not generated"
    fi
    
    if [ -n "$SUPABASE_REFRESH_TOKEN" ] && [ "$SUPABASE_REFRESH_TOKEN" != "null" ]; then
        log_success "Supabase refresh token generated"
    else
        log_warning "Supabase refresh token not generated (may be expected)"
    fi
else
    log_warning "Supabase tokens not in response (may be expected if service key not configured)"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

