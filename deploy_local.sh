#!/bin/bash

# ============================================================================
# EquiBaskets - Local Deployment Script
# ============================================================================
# This script builds contracts and generates deployment artifacts.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         EquiBaskets - Local Deployment Setup                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Aiken
echo -e "${YELLOW}[1/5] Checking Aiken installation...${NC}"
if command -v aiken &> /dev/null; then
    AIKEN_VERSION=$(aiken --version)
    echo -e "${GREEN}✓ Aiken found: $AIKEN_VERSION${NC}"
else
    echo -e "${RED}✗ Aiken not found. Please install Aiken first.${NC}"
    echo "  Install: curl -sSfL https://install.aiken-lang.org | bash"
    exit 1
fi

# Build project
echo -e "${YELLOW}[2/5] Building contracts...${NC}"
if aiken build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Run tests
echo -e "${YELLOW}[3/5] Running tests...${NC}"
if aiken check; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "  Run './run_tests.sh' for detailed output"
fi

# Generate plutus.json
echo -e "${YELLOW}[4/5] Generating Plutus blueprints...${NC}"
if [ -f "plutus.json" ]; then
    echo -e "${GREEN}✓ plutus.json generated${NC}"
    
    # Extract validator hashes
    echo ""
    echo -e "${BLUE}Validator Hashes:${NC}"
    echo "─────────────────────────────────────────────────────────"
    
    # Parse plutus.json for validator info
    if command -v jq &> /dev/null; then
        jq -r '.validators[] | "\(.title): \(.hash)"' plutus.json 2>/dev/null || echo "  (install jq for detailed output)"
    else
        echo "  Install jq to see validator hashes: brew install jq"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ plutus.json not found - run 'aiken build' again${NC}"
fi

# Create deployment directory
echo -e "${YELLOW}[5/5] Setting up deployment artifacts...${NC}"
DEPLOY_DIR="deployment"
mkdir -p $DEPLOY_DIR

# Copy compiled scripts
if [ -f "plutus.json" ]; then
    cp plutus.json $DEPLOY_DIR/
    echo -e "${GREEN}✓ Copied plutus.json to $DEPLOY_DIR/${NC}"
fi

# Create sample deployment config
cat > $DEPLOY_DIR/config.json << 'EOF'
{
  "network": "preview",
  "contracts": {
    "mockOracle": {
      "name": "mock_oracle",
      "description": "Oracle providing asset prices"
    },
    "basketFactory": {
      "name": "basket_factory",
      "description": "Basket registration and management"
    },
    "vault": {
      "name": "vault",
      "description": "Collateral and minting logic"
    },
    "basketTokenPolicy": {
      "name": "basket_token_policy",
      "description": "Token minting policy"
    }
  },
  "parameters": {
    "pricePrecision": 1000000,
    "collateralRatio": 1500000,
    "liquidationBonus": 50000,
    "minCollateral": 2000000
  },
  "testAssets": [
    {"id": "BTC", "price": 60000000000},
    {"id": "ETH", "price": 3000000000},
    {"id": "SOL", "price": 150000000},
    {"id": "ADA", "price": 500000}
  ]
}
EOF
echo -e "${GREEN}✓ Created deployment config${NC}"

# Create sample scripts for offchain
cat > $DEPLOY_DIR/extract_scripts.js << 'EOF'
// Script to extract compiled Plutus scripts for offchain use
// Run with: node extract_scripts.js

const fs = require('fs');

const plutus = JSON.parse(fs.readFileSync('../plutus.json', 'utf8'));

const scripts = {};

for (const validator of plutus.validators) {
  const name = validator.title.split('.').pop();
  scripts[name] = {
    type: 'PlutusV3',
    script: validator.compiledCode,
    hash: validator.hash
  };
}

// Write to TypeScript file
const tsContent = `// Auto-generated from plutus.json
// Generated at: ${new Date().toISOString()}

import { applyDoubleCborEncoding } from "@evolution-sdk/lucid";

export const Scripts = {
${Object.entries(scripts).map(([name, data]) => 
  `  ${name}: applyDoubleCborEncoding("${data.script}")`
).join(',\n')}
};

export const ScriptHashes = {
${Object.entries(scripts).map(([name, data]) => 
  `  ${name}: "${data.hash}"`
).join(',\n')}
};
`;

fs.writeFileSync('scripts.ts', tsContent);
console.log('Generated scripts.ts');
EOF
echo -e "${GREEN}✓ Created script extraction utility${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Deployment Setup Complete!                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Artifacts created in: ./$DEPLOY_DIR/${NC}"
echo ""
echo "Next steps:"
echo "  1. Review plutus.json for compiled scripts"
echo "  2. Update offchain/config/script.ts with new script hashes"
echo "  3. Deploy to testnet using Lucid or cardano-cli"
echo ""
echo "For testnet deployment:"
echo "  - Set BLOCKFROST_API_KEY environment variable"
echo "  - Or configure Koios provider in offchain/config/lucid.ts"
echo ""

