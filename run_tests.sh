#!/bin/bash

# ============================================================================
# EquiBaskets - Test Runner Script
# ============================================================================
# This script builds the project and runs all tests, generating a report.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output file
REPORT_FILE="TEST_REPORT.md"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            EquiBaskets - Test Runner                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Start report
cat > $REPORT_FILE << 'EOF'
# EquiBaskets - Test Report

## Test Execution Summary

EOF

echo "**Test Run Date:** $(date)" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Step 1: Check Aiken installation
echo -e "${YELLOW}[1/4] Checking Aiken installation...${NC}"
if command -v aiken &> /dev/null; then
    AIKEN_VERSION=$(aiken --version)
    echo -e "${GREEN}✓ Aiken found: $AIKEN_VERSION${NC}"
    echo "**Aiken Version:** $AIKEN_VERSION" >> $REPORT_FILE
else
    echo -e "${RED}✗ Aiken not found. Please install Aiken first.${NC}"
    echo "**Error:** Aiken not found" >> $REPORT_FILE
    exit 1
fi
echo "" >> $REPORT_FILE

# Step 2: Format code
echo -e "${YELLOW}[2/4] Formatting code...${NC}"
if aiken fmt 2>/dev/null; then
    echo -e "${GREEN}✓ Code formatted${NC}"
else
    echo -e "${YELLOW}⚠ Code formatting had issues (continuing)${NC}"
fi

# Step 3: Build project
echo -e "${YELLOW}[3/4] Building project...${NC}"
echo "## Build Output" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo '```' >> $REPORT_FILE

BUILD_OUTPUT=$(aiken build 2>&1) || true
echo "$BUILD_OUTPUT"
echo "$BUILD_OUTPUT" >> $REPORT_FILE

echo '```' >> $REPORT_FILE
echo "" >> $REPORT_FILE

if echo "$BUILD_OUTPUT" | grep -q "error"; then
    echo -e "${RED}✗ Build failed${NC}"
    echo "**Build Status:** ❌ Failed" >> $REPORT_FILE
else
    echo -e "${GREEN}✓ Build successful${NC}"
    echo "**Build Status:** ✅ Passed" >> $REPORT_FILE
fi
echo "" >> $REPORT_FILE

# Step 4: Run tests
echo -e "${YELLOW}[4/4] Running tests...${NC}"
echo "## Test Output" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo '```' >> $REPORT_FILE

TEST_OUTPUT=$(aiken check 2>&1) || true
echo "$TEST_OUTPUT"
echo "$TEST_OUTPUT" >> $REPORT_FILE

echo '```' >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Parse test results
PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' || echo "0")
FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= failed)' || echo "0")

echo "## Test Results Summary" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "| Metric | Count |" >> $REPORT_FILE
echo "|--------|-------|" >> $REPORT_FILE
echo "| Passed | $PASSED |" >> $REPORT_FILE
echo "| Failed | $FAILED |" >> $REPORT_FILE
echo "" >> $REPORT_FILE

if [ "$FAILED" = "0" ] && [ "$PASSED" != "0" ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ALL TESTS PASSED! ✓                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo "**Overall Status:** ✅ All tests passed!" >> $REPORT_FILE
elif [ "$FAILED" != "0" ]; then
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    SOME TESTS FAILED ✗                         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo "**Overall Status:** ❌ $FAILED test(s) failed" >> $REPORT_FILE
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                    NO TESTS FOUND                              ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo "**Overall Status:** ⚠️ No tests found or executed" >> $REPORT_FILE
fi

echo ""
echo "---" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "## Contract Files" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "| File | Description |" >> $REPORT_FILE
echo "|------|-------------|" >> $REPORT_FILE
echo "| \`validators/types.ak\` | Shared type definitions and constants |" >> $REPORT_FILE
echo "| \`validators/mock_oracle.ak\` | Mock oracle for asset prices |" >> $REPORT_FILE
echo "| \`validators/basket_factory.ak\` | Basket registration and management |" >> $REPORT_FILE
echo "| \`validators/vault.ak\` | Collateral and minting logic |" >> $REPORT_FILE
echo "| \`validators/basket_token_policy.ak\` | Token minting policy |" >> $REPORT_FILE
echo "| \`validators/tests/integration.ak\` | Integration test suite |" >> $REPORT_FILE
echo "" >> $REPORT_FILE

echo -e "${BLUE}Report written to: ${NC}$REPORT_FILE"
echo ""

# Run specific test suites if requested
if [ "$1" = "--types" ]; then
    echo -e "${YELLOW}Running types tests only...${NC}"
    aiken check -m types
elif [ "$1" = "--oracle" ]; then
    echo -e "${YELLOW}Running oracle tests only...${NC}"
    aiken check -m oracle
elif [ "$1" = "--vault" ]; then
    echo -e "${YELLOW}Running vault tests only...${NC}"
    aiken check -m vault
elif [ "$1" = "--integration" ]; then
    echo -e "${YELLOW}Running integration tests only...${NC}"
    aiken check -m integration
fi

exit 0

