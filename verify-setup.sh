#!/bin/bash
# Quick verification script for WhatsApp Tool setup

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         WhatsApp Tool - Setup Verification Script             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Environment file
echo "1. Checking .env file..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    if grep -q "BACKEND_PORT=3001" .env && grep -q "DASHBOARD_PORT=3002" .env; then
        echo -e "${GREEN}✅ Port configurations found${NC}"
    else
        echo -e "${YELLOW}⚠️  Port configurations may be missing${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
fi
echo ""

# Check 2: Dependencies
echo "2. Checking dependencies..."
for dir in "." "backend" "dashboard" "bulk-sender"; do
    if [ -d "$dir/node_modules" ]; then
        echo -e "${GREEN}✅ $dir/node_modules exists${NC}"
    else
        echo -e "${RED}❌ $dir/node_modules missing - run 'npm install' in $dir${NC}"
    fi
done
echo ""

# Check 3: Server files
echo "3. Checking server files..."
for file in "server.js" "backend/server.js" "dashboard/server.js"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
    fi
done
echo ""

# Check 4: Startup scripts
echo "4. Checking startup scripts..."
for file in "start-all.bat" "start-all.sh" "stop-all.bat"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
    fi
done
echo ""

# Check 5: Database setup script
echo "5. Checking database setup..."
if [ -f "COMPLETE_DATABASE_SETUP.sql" ]; then
    echo -e "${GREEN}✅ COMPLETE_DATABASE_SETUP.sql exists${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: You must run this SQL in Supabase!${NC}"
else
    echo -e "${RED}❌ COMPLETE_DATABASE_SETUP.sql not found${NC}"
fi
echo ""

# Check 6: Port availability
echo "6. Checking port availability..."
for port in 3000 3001 3002; do
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${RED}❌ Port $port is in use${NC}"
        else
            echo -e "${GREEN}✅ Port $port is available${NC}"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -ano | grep ":$port " | grep "LISTENING" >/dev/null 2>&1; then
            echo -e "${RED}❌ Port $port is in use${NC}"
        else
            echo -e "${GREEN}✅ Port $port is available${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot check port $port (lsof/netstat not available)${NC}"
    fi
done
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      VERIFICATION COMPLETE                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Run the SQL script in Supabase (COMPLETE_DATABASE_SETUP.sql)"
echo "2. Start servers with: ./start-all.sh (or start-all.bat on Windows)"
echo "3. Access dashboard at: http://localhost:3000"
echo ""
