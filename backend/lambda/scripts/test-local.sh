#!/bin/bash

# ============================================================================
# LOCAL TESTING SCRIPT
# ============================================================================
# Tests Lambda function locally using serverless-offline
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Warmpawz Local Testing Setup ===${NC}\n"

# Step 1: Check if build exists
if [ ! -f "dist/handler.js" ]; then
    echo -e "${YELLOW}[1/4] Building Lambda function...${NC}"
    npm run build:bundle
else
    echo -e "${GREEN}[1/4] Build exists ✓${NC}"
fi

# Step 2: Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}[2/4] Creating .env.local from example...${NC}"
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo -e "${GREEN}✓ Created .env.local${NC}"
        echo -e "${YELLOW}⚠️  Please update .env.local with your local database credentials${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.local.example not found, creating basic .env.local${NC}"
        cat > .env.local << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warmpawz
DB_USER=postgres
DB_PASSWORD=postgres
COGNITO_USER_POOL_ID=ap-south-1_TEST123
COGNITO_CLIENT_ID=test-client-id
UAT_MODE=true
EOF
    fi
else
    echo -e "${GREEN}[2/4] .env.local exists ✓${NC}"
fi

# Step 3: Check if serverless-offline is installed
if ! npm list serverless-offline &> /dev/null; then
    echo -e "${YELLOW}[3/4] Installing serverless-offline...${NC}"
    npm install --save-dev serverless-offline
else
    echo -e "${GREEN}[3/4] serverless-offline installed ✓${NC}"
fi

# Step 4: Start serverless-offline
echo -e "${GREEN}[4/4] Starting serverless-offline...${NC}\n"
echo -e "${BLUE}Server will start at: http://localhost:3000${NC}"
echo -e "${BLUE}Press Ctrl+C to stop${NC}\n"

# Load environment variables from .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Start serverless-offline (use local version)
npx serverless offline --config serverless.local.yml

