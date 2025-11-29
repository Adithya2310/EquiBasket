# EquiBasket - Decentralized Synthetic Baskets on Cardano

Trade Real-World Baskets. Instantly, On-Chain. Mint and trade synthetic equity baskets backed by ADA collateral.

## 🚀 Features

- **Decentralized & Secure**: Built on Cardano with Aiken smart contracts
- **Synthetic Baskets**: Create and trade custom baskets of assets
- **ADA Collateral**: Over-collateralized positions with 150% ratio
- **Real-time Oracle**: Price feeds for accurate basket valuations
- **On-chain Transactions**: All operations are real Cardano transactions

## 📁 Project Structure

```
offchain/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page
│   ├── create/page.tsx           # Create basket page
│   ├── mint-burn/page.tsx        # Mint & Burn page
│   ├── trade/page.tsx            # Trade page
│   ├── Home.tsx                  # Main app component with routing
│   ├── client.tsx                # Client wrapper
│   ├── layout.tsx                # Root layout
│   └── providers.tsx             # Context providers
├── components/
│   ├── ui/                       # Lightweight custom UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   └── index.ts
│   ├── shared/                   # Shared components
│   │   ├── Navbar.tsx
│   │   ├── TransactionStatus.tsx
│   │   ├── CollateralRatioBar.tsx
│   │   └── PieChart.tsx
│   ├── pages/                    # Page-specific components
│   │   ├── Landing/
│   │   ├── Dashboard/
│   │   ├── CreateBasket/
│   │   ├── MintBurn/
│   │   └── Trade/
│   └── connection/               # Wallet connection context
├── config/
│   ├── lucid.ts                  # Lucid Evolution config
│   ├── scripts.ts                # Compiled Aiken scripts & constants
│   ├── site.ts                   # Site configuration
│   └── fonts.ts                  # Font configuration
├── lib/
│   ├── tx-builder.ts             # Transaction builder utilities
│   └── database.ts               # Turso database service layer
├── components/
│   └── database/
│       └── DatabaseProvider.tsx  # Database context provider
├── types/
│   ├── equibasket.ts             # EquiBasket type definitions
│   ├── cardano.ts                # Cardano wallet types
│   └── index.ts
└── styles/
    └── globals.css               # Global styles
```

## 🛠️ Technologies Used

- **Next.js 14** - React framework with App Router
- **Lucid Evolution** - Cardano transaction building library
- **Aiken** - Smart contract language for Cardano
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **Turso (libSQL)** - Edge database for data persistence

## 📋 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- A Cardano wallet (Eternl, Nami, Lace, etc.)
- Test ADA on Preview network

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd offchain
pnpm install
```

### 2. Build Aiken Scripts (from project root)

```bash
cd ..
aiken build
```

### 3. Configure Turso Database

The app uses Turso (libSQL) for data persistence. You need to set up a Turso database:

#### a. Create a Turso Account & Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login to Turso
turso auth login

# Create a database
turso db create equibasket

# Get database URL
turso db show equibasket --url

# Create auth token
turso db tokens create equibasket
```

#### b. Configure Environment Variables

Create a `.env.local` file in the `offchain` directory:

```bash
# offchain/.env.local
NEXT_PUBLIC_TURSO_DATABASE_URL=libsql://equibasket-[your-org].turso.io
NEXT_PUBLIC_TURSO_AUTH_TOKEN=your-auth-token-here
```

> **Note**: The `NEXT_PUBLIC_` prefix is required because the database client runs in the browser.

### 4. Start Development Server

```bash
cd offchain
pnpm dev
```

The app will be available at `http://localhost:3000`

### 4. Connect Wallet

1. Open the app in your browser
2. Click "Connect Wallet" or "Launch App"
3. Select your preferred wallet (e.g., Eternl, Nami)
4. Approve the connection request

## 📖 User Guide

### Creating a Basket

1. Navigate to **Create Basket** page
2. Enter a basket name and optional description
3. Search and add assets (BTC, ETH, SOL, etc.)
4. Adjust weights for each asset (must sum to 100%)
5. Review the preview pie chart
6. Click **Create Basket** and sign the transaction

### Minting Tokens

1. Navigate to **Mint & Burn** page
2. Select a basket from the dropdown
3. Enter the amount to mint
4. Review the required collateral (150% ratio)
5. Click **Mint** and sign the transaction

### Burning Tokens

1. Navigate to **Mint & Burn** page
2. Select the **Burn** tab
3. Enter the amount to burn
4. Click **Burn** and sign the transaction

### Trading (UI Demo)

The Trade page provides a UI for future DEX integration:
- View basket price charts
- Buy/Sell interface
- Order history

## 🔧 Configuration

### Network Configuration

Edit `config/lucid.ts` to change the network:

```typescript
export const network: Network = "Preview"; // or "Mainnet", "Preprod"
```

### Oracle Prices

Default prices are in `config/scripts.ts`:

```typescript
export const DEFAULT_PRICES: Array<[string, bigint]> = [
  ["BTC", 60_000n * PRICE_PRECISION],
  ["ETH", 3_000n * PRICE_PRECISION],
  // ...
];
```

## 📊 Transaction Flow

### Full Transaction Lifecycle

1. **Build Transaction**: Use `EquiBasketTxBuilder` to construct the transaction
2. **Sign Transaction**: Wallet prompts user for signature
3. **Submit Transaction**: Transaction is submitted to the Cardano network
4. **Confirmation**: Transaction hash is returned on success

```typescript
// Example: Creating a basket
const txBuilder = new EquiBasketTxBuilder(lucid, address, pkh);
const tx = await txBuilder.createBasket(basketId, name, assets);
const txHash = await submitTx(tx);
```

## 🧪 Testing

### Run Aiken Tests

```bash
cd ..
aiken check
```

### Run Frontend Lint

```bash
cd offchain
pnpm lint
```

## 📝 Smart Contract Interaction

The frontend interacts with these Aiken validators:

| Validator | Purpose |
|-----------|---------|
| `basket_factory` | Manages basket definitions |
| `mock_oracle` | Provides price feeds |
| `vault` | Manages collateral and positions |
| `basket_token_policy` | Controls basket token minting |

## 🐛 Troubleshooting

### Database Not Configured Error
If you see "Database not configured" or "URL_SCHEME_NOT_SUPPORTED" error:
- Ensure `.env.local` file exists in the `offchain` directory
- Check that `NEXT_PUBLIC_TURSO_DATABASE_URL` starts with `libsql://` (not `file:`)
- Verify your Turso auth token is valid
- Restart the development server after changing `.env.local`

### Wallet Not Connecting
- Ensure you have a compatible wallet installed
- Check that you're on the correct network (Preview)
- Try refreshing the page

### Transaction Failed
- Check you have enough ADA for fees (at least 5-10 ADA recommended)
- Ensure collateral ratio is above 150%
- Review the error message in the UI

### Script Errors
- Rebuild Aiken scripts: `aiken build`
- Check that `plutus.json` is up to date

## 📚 Resources

- [Aiken Documentation](https://aiken-lang.org/)
- [Lucid Evolution](https://github.com/lucid-evolution/lucid)
- [Cardano Developer Portal](https://developers.cardano.org/)

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for Cardano IBW 2025
