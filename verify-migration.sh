#!/bin/bash
# Baileys Migration Verification Script
# Run this to verify all fixes are in place

echo "=================================================="
echo "  BAILEYS MIGRATION VERIFICATION"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to check syntax
check_syntax() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if node -c "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC} - Syntax check: $1"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Syntax check: $1"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# Function to check for forbidden imports
check_no_import() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${RED}❌ FAIL${NC} - Found forbidden import '$2' in: $1"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    else
        echo -e "${GREEN}✅ PASS${NC} - No '$2' in: $1"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
}

# Function to check for required code
check_contains() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC} - Found required code '$2' in: $1"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Missing required code '$2' in: $1"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

echo "🔍 PHASE 1: SYNTAX CHECKS"
echo "=================================================="
check_syntax "server.js"
check_syntax "backend/services/whatsappService.js"
check_syntax "backend/services/bulkSenderService.js"
check_syntax "backend/services/agentService.js"
check_syntax "backend/services/validatorService.js"
check_syntax "backend/services/campaignService.js"
check_syntax "backend/routes/campaigns.js"
check_syntax "validator.js"
echo ""

echo "🔍 PHASE 2: FORBIDDEN IMPORTS CHECK"
echo "=================================================="
check_no_import "server.js" "whatsapp-web.js"
check_no_import "server.js" "MessageMedia"
check_no_import "backend/services/whatsappService.js" "whatsapp-web.js"
check_no_import "backend/services/agentService.js" "whatsapp-web.js"
check_no_import "backend/services/validatorService.js" "whatsapp-web.js"
check_no_import "validator.js" "whatsapp-web.js"
echo ""

echo "🔍 PHASE 3: REQUIRED CODE CHECK"
echo "=================================================="
check_contains "server.js" "@s.whatsapp.net"
check_contains "server.js" "bulkSenderService.initialize"
check_contains "server.js" "whatsappService.initialize"
check_contains "backend/services/whatsappService.js" "class WhatsAppService"
check_contains "backend/services/whatsappService.js" "initialize(whatsappClients, io)"
check_contains "backend/services/bulkSenderService.js" "@s.whatsapp.net"
check_contains "validator.js" "onWhatsApp"
echo ""

echo "🔍 PHASE 4: JID FORMAT CHECK"
echo "=================================================="
check_no_import "server.js" "@c.us"
echo ""

echo "=================================================="
echo "  VERIFICATION RESULTS"
echo "=================================================="
echo ""
echo "Total Checks:  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:        $PASSED_CHECKS${NC}"
echo -e "${RED}Failed:        $FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo -e "${GREEN}✅ Baileys migration is complete and verified.${NC}"
    echo ""
    echo "You can now start the server:"
    echo "  npm start"
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED!${NC}"
    echo -e "${RED}Please review the errors above and fix them.${NC}"
    echo ""
    echo "Check the documentation:"
    echo "  - BAILEYS_MIGRATION_COMPLETE.md"
    echo "  - MODULE_NOT_FOUND_FIX_COMPLETE.md"
    exit 1
fi
