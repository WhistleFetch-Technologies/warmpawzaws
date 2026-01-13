# WARMPAWZ UI E2E TESTING - INTEGRATION GUIDE

**Status:** ✅ Full E2E Integration Complete

---

## ✅ INTEGRATIONS COMPLETE

### 1. Browser Automation ✅
- **Tool:** Playwright
- **Status:** Integrated
- **Features:**
  - Real browser interactions (click, type, select, navigate)
  - Screenshot capture on failure
  - Video recording
  - Element verification
  - Multi-role page management

### 2. Real API Calls ✅
- **Status:** Integrated
- **Features:**
  - Real HTTP requests to API endpoints
  - Authentication token support
  - Response validation
  - Error handling

### 3. Database Connection ✅
- **Tool:** PostgreSQL (pg)
- **Status:** Integrated
- **Features:**
  - Real database queries
  - Select, count, exists operations
  - Template variable support
  - Connection pooling

### 4. Event Listeners ✅
- **Tools:** AWS SDK (SNS, EventBridge, SQS)
- **Status:** Integrated
- **Features:**
  - Real event listening
  - Event payload validation
  - Timeout handling
  - Multi-source support (SNS, EventBridge, SQS)

---

## 🚀 SETUP INSTRUCTIONS

### 1. Install Dependencies
```bash
cd tests/ui-e2e
npm install
npm run install-browsers  # Install Playwright browsers
```

### 2. Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Required Environment Variables

#### API Configuration
```bash
API_BASE_URL=https://dev.api.warmpawz.com
AUTH_TOKEN=your-auth-token-here
```

#### UI Configuration
```bash
UI_BASE_URL=http://localhost:3000
HEADLESS=true  # Set to false to see browser
```

#### Database Configuration
```bash
DB_CONNECTION_STRING=postgresql://user:password@host:5432/database
```

#### AWS Configuration
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
EVENT_BRIDGE_BUS=warmpawz-events
SNS_TOPIC_ARN=arn:aws:sns:region:account:topic
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue
```

#### Feature Flags
```bash
USE_BROWSER_AUTOMATION=true  # Enable browser automation
USE_REAL_API=true            # Enable real API calls
USE_REAL_DB=true             # Enable real DB validation
USE_REAL_EVENTS=true         # Enable real event validation
```

---

## 🎯 USAGE

### Run All Tests
```bash
npm run test
```

### Run Tests by Role
```bash
npm run test:admin
npm run test:customer
npm run test:vendor
```

### Run with Specific Configuration
```bash
# Headless mode (default)
HEADLESS=true npm run test

# Visible browser
HEADLESS=false npm run test

# Skip browser automation (API-only)
USE_BROWSER_AUTOMATION=false npm run test

# Skip database validation
USE_REAL_DB=false npm run test
```

---

## 📊 INTEGRATION DETAILS

### Browser Automation
- **Module:** `browser-automation.ts`
- **Features:**
  - Multi-page management (one per role)
  - Automatic screenshot on failure
  - Video recording
  - Element verification
  - Navigation handling

### API Integration
- **Module:** `test-execution-engine.ts` (validateAPI method)
- **Features:**
  - Automatic authentication header injection
  - Response validation
  - Error handling
  - Timeout management

### Database Integration
- **Module:** `database-client.ts`
- **Features:**
  - Connection pooling
  - Query execution
  - Result validation
  - Template variable support

### Event Integration
- **Module:** `event-listener.ts`
- **Features:**
  - Multi-source support (SNS, EventBridge, SQS)
  - Event queuing
  - Payload validation
  - Timeout handling

---

## 🔧 TROUBLESHOOTING

### Browser Issues
```bash
# Reinstall browsers
npm run install-browsers

# Run with visible browser
HEADLESS=false npm run test
```

### Database Connection Issues
```bash
# Test connection
psql $DB_CONNECTION_STRING -c "SELECT 1"

# Check environment variable
echo $DB_CONNECTION_STRING
```

### API Authentication Issues
```bash
# Verify token
curl -H "Authorization: Bearer $AUTH_TOKEN" $API_BASE_URL/health

# Check environment variable
echo $AUTH_TOKEN
```

### Event Listener Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $EVENT_BRIDGE_BUS
```

---

## 📝 NOTES

1. **Browser Automation:** Requires Playwright browsers to be installed
2. **Database:** Requires PostgreSQL connection string
3. **Events:** Requires AWS credentials and proper IAM permissions
4. **API:** Requires valid authentication token

---

## ✅ STATUS

**All integrations complete and ready for use!**

The framework now supports:
- ✅ Real browser automation
- ✅ Real API calls
- ✅ Real database validation
- ✅ Real event validation

**Next:** Configure environment variables and run tests!
