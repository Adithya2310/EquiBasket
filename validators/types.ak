//// EquiBaskets - Shared Type Definitions
//// 
//// This module contains all shared types used across the EquiBaskets protocol.

use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference}

// ============================================================================
// CONSTANTS
// ============================================================================

/// Price precision: 1e6 (1 unit = 1,000,000)
pub const price_precision: Int = 1_000_000

/// Collateral ratio: 150% expressed in 1e6 (1,500,000)
pub const collateral_ratio: Int = 1_500_000

/// Liquidation bonus: 5% expressed in 1e6 (50,000)
pub const liquidation_bonus: Int = 50_000

/// Weight precision: 10000 basis points = 100%
pub const weight_precision: Int = 10_000

/// Minimum collateral: 2 ADA in lovelace
pub const min_collateral: Int = 2_000_000

// ============================================================================
// ORACLE TYPES
// ============================================================================

/// Asset identifier for oracle prices
pub type AssetId =
  ByteArray

/// Oracle datum storing asset prices
pub type OracleDatum {
  /// List of asset prices: (AssetId, price in 1e6 precision)
  prices: List<(AssetId, Int)>,
  /// POSIX timestamp of last update
  last_updated: Int,
  /// Admin verification key hash who can update prices
  admin: VerificationKeyHash,
}

/// Oracle redeemer actions
pub type OracleRedeemer {
  /// Update prices (admin only)
  UpdatePrices { new_prices: List<(AssetId, Int)> }
  /// Read-only reference (does not consume UTxO)
  ReadPrice
}

// ============================================================================
// BASKET TYPES
// ============================================================================

/// Basket definition datum
pub type BasketDatum {
  /// Unique basket identifier
  basket_id: ByteArray,
  /// Human-readable basket name
  name: ByteArray,
  /// List of assets and their weights (sum must equal weight_precision)
  assets: List<(AssetId, Int)>,
  /// Creator verification key hash
  creator: VerificationKeyHash,
  /// Creation POSIX timestamp
  created_at: Int,
}

/// Basket factory redeemer actions
pub type BasketRedeemer {
  /// Create a new basket
  CreateBasket
  /// Update basket weights (creator only)
  UpdateBasket { new_weights: List<(AssetId, Int)> }
}

// ============================================================================
// VAULT TYPES
// ============================================================================

/// Vault position datum
pub type VaultDatum {
  /// Position owner
  owner: VerificationKeyHash,
  /// Associated basket ID
  basket_id: ByteArray,
  /// Deposited ADA collateral in lovelace
  collateral_ada: Int,
  /// Number of basket tokens minted
  minted_tokens: Int,
  /// Position creation timestamp
  created_at: Int,
}

/// Vault redeemer actions
pub type VaultRedeemer {
  /// Deposit additional ADA collateral
  Deposit { amount: Int }
  /// Withdraw excess collateral
  Withdraw { amount: Int }
  /// Mint basket tokens
  Mint { amount: Int }
  /// Burn basket tokens
  Burn { amount: Int }
  /// Liquidate undercollateralized position
  Liquidate
}

// ============================================================================
// MINTING POLICY TYPES
// ============================================================================

/// Minting action type
pub type MintAction {
  /// Mint new tokens
  MintTokens
  /// Burn existing tokens
  BurnTokens
}

/// Minting policy redeemer
pub type MintRedeemer {
  /// Mint or burn action
  action: MintAction,
  /// Reference to the Vault UTxO authorizing this mint/burn
  vault_ref: OutputReference,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Calculate basket price from oracle prices and weights
/// Returns price in 1e6 precision
pub fn calculate_basket_price(
  oracle_prices: List<(AssetId, Int)>,
  basket_assets: List<(AssetId, Int)>,
) -> Int {
  do_calculate_basket_price(oracle_prices, basket_assets, 0)
}

fn do_calculate_basket_price(
  oracle_prices: List<(AssetId, Int)>,
  basket_assets: List<(AssetId, Int)>,
  acc: Int,
) -> Int {
  when basket_assets is {
    [] -> acc
    [(asset_id, weight), ..rest] -> {
      let price = find_price(oracle_prices, asset_id)
      // weighted_price = price * weight / weight_precision
      let weighted_price = price * weight / weight_precision
      do_calculate_basket_price(oracle_prices, rest, acc + weighted_price)
    }
  }
}

/// Find price for an asset in the oracle prices list
pub fn find_price(prices: List<(AssetId, Int)>, asset_id: AssetId) -> Int {
  when prices is {
    [] -> fail @"Asset not found in oracle"
    [(id, price), ..rest] ->
      if id == asset_id {
        price
      } else {
        find_price(rest, asset_id)
      }
  }
}

/// Check if collateral ratio is healthy
/// Returns true if collateral_value >= minted_value * collateral_ratio / price_precision
pub fn is_healthy(collateral_value: Int, minted_value: Int) -> Bool {
  collateral_value * price_precision >= minted_value * collateral_ratio
}

/// Calculate liquidation value (collateral minus bonus)
pub fn liquidation_value(collateral: Int) -> Int {
  collateral * ( price_precision - liquidation_bonus ) / price_precision
}

/// Sum weights in a basket (should equal weight_precision)
pub fn sum_weights(assets: List<(AssetId, Int)>) -> Int {
  do_sum_weights(assets, 0)
}

fn do_sum_weights(assets: List<(AssetId, Int)>, acc: Int) -> Int {
  when assets is {
    [] -> acc
    [(_, weight), ..rest] -> do_sum_weights(rest, acc + weight)
  }
}

// ============================================================================
// TESTS
// ============================================================================

test test_price_precision() {
  price_precision == 1_000_000
}

test test_collateral_ratio() {
  collateral_ratio == 1_500_000
}

test test_sum_weights() {
  let assets = [("BTC", 5000), ("ETH", 3000), ("SOL", 2000)]
  sum_weights(assets) == 10_000
}

test test_find_price() {
  let prices =
    [("BTC", 60_000_000_000), ("ETH", 3_000_000_000), ("SOL", 150_000_000)]
  and {
    find_price(prices, "BTC") == 60_000_000_000,
    find_price(prices, "ETH") == 3_000_000_000,
    find_price(prices, "SOL") == 150_000_000,
  }
}

test test_calculate_basket_price() {
  // BTC: $60,000 (60_000_000_000 in 1e6), weight 50% (5000)
  // ETH: $3,000 (3_000_000_000 in 1e6), weight 30% (3000)
  // SOL: $150 (150_000_000 in 1e6), weight 20% (2000)
  let prices =
    [("BTC", 60_000_000_000), ("ETH", 3_000_000_000), ("SOL", 150_000_000)]
  let assets = [("BTC", 5000), ("ETH", 3000), ("SOL", 2000)]
  // Expected: 60000 * 0.5 + 3000 * 0.3 + 150 * 0.2 = 30000 + 900 + 30 = 30930
  // In 1e6: 30_930_000_000
  let expected = 30_930_000_000
  calculate_basket_price(prices, assets) == expected
}

test test_is_healthy_good() {
  // collateral: 150 ADA worth, minted: 100 tokens at $1 each
  // 150 >= 100 * 1.5 = 150, so exactly at threshold
  is_healthy(150_000_000, 100_000_000)
}

test test_is_healthy_under() {
  // collateral: 140 ADA worth, minted: 100 tokens at $1 each
  // 140 < 100 * 1.5 = 150, undercollateralized
  !is_healthy(140_000_000, 100_000_000)
}

test test_is_healthy_over() {
  // collateral: 200 ADA worth, minted: 100 tokens at $1 each
  // 200 > 100 * 1.5 = 150, overcollateralized
  is_healthy(200_000_000, 100_000_000)
}

test test_liquidation_value() {
  // 100 ADA with 5% discount = 95 ADA
  liquidation_value(100_000_000) == 95_000_000
}
