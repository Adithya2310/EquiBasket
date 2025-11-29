// EquiBaskets - Type Definitions

// =============================================================================
// ORACLE TYPES
// =============================================================================

export interface OracleDatum {
  prices: Array<[string, bigint]>;  // [AssetId, Price in 1e6]
  last_updated: bigint;             // POSIX timestamp
  admin: string;                    // VerificationKeyHash
}

export type OracleRedeemer = 
  | { UpdatePrices: { new_prices: Array<[string, bigint]> } }
  | { ReadPrice: {} };

// =============================================================================
// BASKET TYPES
// =============================================================================

export interface BasketAsset {
  id: string;
  weight: number;  // In basis points (10000 = 100%)
}

export interface BasketDatum {
  basket_id: string;
  name: string;
  assets: BasketAsset[];
  creator: string;          // VerificationKeyHash
  created_at: bigint;       // POSIX timestamp
}

export type BasketRedeemer = 
  | { CreateBasket: {} }
  | { UpdateBasket: { new_weights: BasketAsset[] } };

// =============================================================================
// VAULT TYPES
// =============================================================================

export interface VaultDatum {
  owner: string;            // VerificationKeyHash
  basket_id: string;
  collateral_ada: bigint;   // In lovelace
  minted_tokens: bigint;
  created_at: bigint;       // POSIX timestamp
}

export type VaultRedeemer = 
  | { Deposit: { amount: bigint } }
  | { Withdraw: { amount: bigint } }
  | { Mint: { amount: bigint } }
  | { Burn: { amount: bigint } }
  | { Liquidate: {} };

// =============================================================================
// MINTING POLICY TYPES
// =============================================================================

export type MintAction = "MintTokens" | "BurnTokens";

export interface MintRedeemer {
  action: MintAction;
  vault_ref: {
    transaction_id: string;
    output_index: number;
  };
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface UserVault {
  utxo_ref: string;
  datum: VaultDatum;
  basket_name: string;
  basket_price: number;
  collateral_ratio: number;
  is_healthy: boolean;
}

export interface PortfolioState {
  total_collateral: bigint;
  total_debt_value: number;
  vaults: UserVault[];
  basket_tokens: Map<string, bigint>;
}

export interface BasketInfo {
  id: string;
  name: string;
  assets: BasketAsset[];
  price: number;           // USD price calculated from oracle
  created_at: Date;
}

export interface OraclePrice {
  asset_id: string;
  price_usd: number;
  last_updated: Date;
}

// =============================================================================
// TRANSACTION STATUS
// =============================================================================

export type TxStatus = 
  | { status: "idle" }
  | { status: "building"; message: string }
  | { status: "signing"; message: string }
  | { status: "submitting"; message: string }
  | { status: "success"; txHash: string; message: string }
  | { status: "error"; error: string };

// =============================================================================
// LOG LEVELS
// =============================================================================

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: unknown;
}

