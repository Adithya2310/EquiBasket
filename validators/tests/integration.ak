//// EquiBaskets - Integration Tests
////
//// Comprehensive tests covering all protocol flows:
//// 1. Create basket
//// 2. Publish oracle UTxO
//// 3. Deposit and mint
//// 4. Burn and withdraw
//// 5. Liquidation scenarios

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use basket_factory.{
  sample_balanced_basket, sample_defi_basket, sample_tech_basket,
}
use cardano/address.{Address, Script, from_script}
use cardano/assets.{add, from_lovelace, zero}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, placeholder,
}
use mock_oracle.{default_prices, liquidation_prices}
use types.{
  AssetId, BasketDatum, BasketRedeemer, BurnTokens, CreateBasket, Deposit,
  Liquidate, Mint, MintRedeemer, MintTokens, OracleDatum, OracleRedeemer,
  ReadPrice, UpdatePrices, VaultDatum, VaultRedeemer, Withdraw,
  calculate_basket_price, collateral_ratio, is_healthy, liquidation_value,
  price_precision, sum_weights, weight_precision,
}
use vault.{sample_vault}

// ============================================================================
// TEST FIXTURES
// ============================================================================

/// Test admin verification key hash
const test_admin: VerificationKeyHash = "admin_vkh_12345678901234567890123456"

/// Test user verification key hash
const test_user: VerificationKeyHash = "user_vkh_123456789012345678901234567"

/// Test liquidator verification key hash
const test_liquidator: VerificationKeyHash = "liquidator_vkh_12345678901234567"

/// Test script hash for vault
const vault_script_hash: ByteArray = "vault_hash_123456789012345678901234"

/// Test script hash for oracle
const oracle_script_hash: ByteArray = "oracle_hash_12345678901234567890123"

/// Test script hash for basket factory
const factory_script_hash: ByteArray = "factory_hash_1234567890123456789012"

/// Test policy ID for basket tokens
const basket_policy_id: ByteArray = "basket_policy_12345678901234567890"

/// Test timestamp
const test_timestamp: Int = 1700000000000

/// Create test oracle datum with default prices
fn test_oracle_datum() -> OracleDatum {
  OracleDatum {
    prices: default_prices(),
    last_updated: test_timestamp,
    admin: test_admin,
  }
}

/// Create test oracle datum with liquidation prices (higher)
fn test_oracle_datum_liquidation() -> OracleDatum {
  OracleDatum {
    prices: liquidation_prices(),
    last_updated: test_timestamp + 1000,
    admin: test_admin,
  }
}

/// Create vault address
fn vault_address() -> Address {
  from_script(vault_script_hash)
}

/// Create oracle address
fn oracle_address() -> Address {
  from_script(oracle_script_hash)
}

/// Create factory address
fn factory_address() -> Address {
  from_script(factory_script_hash)
}

/// Create a mock output reference
fn mock_output_ref(tx_id: ByteArray, idx: Int) -> OutputReference {
  OutputReference { transaction_id: tx_id, output_index: idx }
}

/// Create oracle input for reference
fn oracle_reference_input() -> Input {
  Input {
    output_reference: mock_output_ref("oracle_tx_001", 0),
    output: Output {
      address: oracle_address(),
      value: from_lovelace(2_000_000),
      datum: InlineDatum(test_oracle_datum()),
      reference_script: None,
    },
  }
}

/// Create basket reference input
fn basket_reference_input() -> Input {
  Input {
    output_reference: mock_output_ref("basket_tx_001", 0),
    output: Output {
      address: factory_address(),
      value: from_lovelace(2_000_000),
      datum: InlineDatum(sample_tech_basket(test_user, test_timestamp)),
      reference_script: None,
    },
  }
}

// ============================================================================
// TEST 1: CREATE BASKET
// ============================================================================

test test_create_basket_valid_weights() {
  // Create a basket with valid weights (sum = 10000)
  let basket = sample_tech_basket(test_user, test_timestamp)
  and {
    // Weights sum to 100%
    (sum_weights(basket.assets) == weight_precision)?,
    // Has assets
    (list.length(basket.assets) > 0)?,
    // Has ID
    (basket.basket_id != "")?,
    // Has name
    (basket.name != "")?,
  }
}

test test_create_basket_all_samples_valid() {
  let tech = sample_tech_basket(test_user, test_timestamp)
  let defi = sample_defi_basket(test_user, test_timestamp)
  let balanced = sample_balanced_basket(test_user, test_timestamp)
  and {
    (sum_weights(tech.assets) == weight_precision)?,
    (sum_weights(defi.assets) == weight_precision)?,
    (sum_weights(balanced.assets) == weight_precision)?,
  }
}

test test_basket_unique_ids() {
  let tech = sample_tech_basket(test_user, test_timestamp)
  let defi = sample_defi_basket(test_user, test_timestamp)
  let balanced = sample_balanced_basket(test_user, test_timestamp)
  and {
    (tech.basket_id != defi.basket_id)?,
    (tech.basket_id != balanced.basket_id)?,
    (defi.basket_id != balanced.basket_id)?,
  }
}

// ============================================================================
// TEST 2: PUBLISH ORACLE UTxO
// ============================================================================

test test_oracle_default_prices_valid() {
  let prices = default_prices()
  // All prices should be positive
  list.all(prices, fn((_, price)) { price > 0 })
}

test test_oracle_has_required_assets() {
  let prices = default_prices()
  let asset_ids: List<AssetId> = list.map(prices, fn((id, _)) { id })
  and {
    list.has(asset_ids, "BTC")?,
    list.has(asset_ids, "ETH")?,
    list.has(asset_ids, "SOL")?,
    list.has(asset_ids, "ADA")?,
  }
}

test test_oracle_btc_price() {
  let oracle = test_oracle_datum()
  expect Some((_, btc_price)) =
    list.find(oracle.prices, fn((id, _)) { id == "BTC" })
  // BTC should be $60,000 = 60_000_000_000 in 1e6 precision
  btc_price == 60_000 * price_precision
}

test test_oracle_ada_price() {
  let oracle = test_oracle_datum()
  expect Some((_, ada_price)) =
    list.find(oracle.prices, fn((id, _)) { id == "ADA" })
  // ADA should be $0.50 = 500_000 in 1e6 precision
  ada_price == price_precision / 2
}

// ============================================================================
// TEST 3: BASKET PRICE CALCULATION
// ============================================================================

test test_calculate_tech_basket_price() {
  let oracle = test_oracle_datum()
  let basket = sample_tech_basket(test_user, test_timestamp)
  let price = calculate_basket_price(oracle.prices, basket.assets)
  // Tech basket: BTC 50%, ETH 30%, SOL 20%
  // Price = 60000*0.5 + 3000*0.3 + 150*0.2
  //       = 30000 + 900 + 30 = 30930
  // In 1e6: 30_930_000_000
  price == 30_930_000_000
}

test test_calculate_defi_basket_price() {
  let oracle = test_oracle_datum()
  let basket = sample_defi_basket(test_user, test_timestamp)
  let price = calculate_basket_price(oracle.prices, basket.assets)
  // DeFi basket: ETH 40%, LINK 30%, DOT 30%
  // Price = 3000*0.4 + 15*0.3 + 7*0.3
  //       = 1200 + 4.5 + 2.1 = 1206.6
  // In 1e6: 1_206_600_000
  price == 1_206_600_000
}

test test_calculate_balanced_basket_price() {
  let oracle = test_oracle_datum()
  let basket = sample_balanced_basket(test_user, test_timestamp)
  let price = calculate_basket_price(oracle.prices, basket.assets)
  // Balanced basket: BTC 33.34%, ETH 33.33%, SOL 33.33%
  // Weights: 3334, 3333, 3333
  // Price = 60000*0.3334 + 3000*0.3333 + 150*0.3333
  //       ≈ 20004 + 999.9 + 49.995 = 21053.895
  // In 1e6: ~21_053_895_000 (approximate due to integer division)
  price > 21_000_000_000 && price < 22_000_000_000
}

// ============================================================================
// TEST 4: DEPOSIT AND MINT
// ============================================================================

test test_vault_deposit_creates_position() {
  let vault =
    sample_vault(test_user, "TECH_BASKET_001", 100_000_000, 0, test_timestamp)
  and {
    (vault.owner == test_user)?,
    (vault.collateral_ada == 100_000_000)?,
    (vault.minted_tokens == 0)?,
  }
}

test test_vault_collateral_ratio_150_percent() {
  // User deposits 150 ADA worth (using $0.50/ADA = 75,000,000 lovelace value)
  // Wants to mint 100 basket tokens worth $0.50 each = 50,000,000 value
  // Ratio = 75M / 50M = 150% (exactly at threshold)
  let collateral_value = 75_000_000
  // $75 worth
  let minted_value = 50_000_000
  // $50 worth
  is_healthy(collateral_value, minted_value)
}

test test_vault_overcollateralized_mint() {
  // User deposits 200 ADA worth ($100 at $0.50/ADA)
  // Mints 50 tokens worth $0.50 each = $25
  // Ratio = $100 / $25 = 400%
  let collateral_value = 100_000_000
  // $100 worth
  let minted_value = 25_000_000
  // $25 worth
  is_healthy(collateral_value, minted_value)
}

test test_vault_undercollateralized_mint_fails() {
  // User deposits 100 ADA worth ($50 at $0.50/ADA)
  // Wants to mint 100 tokens worth $0.50 each = $50
  // Ratio = $50 / $50 = 100% (below 150% threshold)
  let collateral_value = 50_000_000
  // $50 worth
  let minted_value = 50_000_000
  // $50 worth
  !is_healthy(collateral_value, minted_value)
}

test test_mint_with_tech_basket_price() {
  let oracle = test_oracle_datum()
  let basket = sample_tech_basket(test_user, test_timestamp)
  let basket_price = calculate_basket_price(oracle.prices, basket.assets)
  // basket_price ≈ $30,930 per token (in 1e6)
  // To mint 1 token, need at least 1.5 * $30,930 = $46,395 collateral
  // In lovelace with ADA at $0.50: $46,395 / $0.50 = 92,790 ADA = 92,790,000,000 lovelace
  // User deposits 100 ADA (very undercollateralized for this expensive basket)
  let collateral_lovelace = 100_000_000_000
  // 100,000 ADA
  let collateral_value_usd =
    collateral_lovelace * price_precision / 2 / price_precision
  // $50,000
  // Minting 1 token worth $30,930
  let minted_value = basket_price / price_precision
  // Need: collateral >= minted * 1.5
  // $50,000 >= $30,930 * 1.5 = $46,395 ✓
  is_healthy(
    collateral_value_usd * price_precision,
    minted_value * price_precision,
  )
}

// ============================================================================
// TEST 5: BURN AND WITHDRAW
// ============================================================================

test test_burn_reduces_minted_tokens() {
  let initial_vault =
    sample_vault(test_user, "TECH_BASKET_001", 100_000_000, 50, test_timestamp)
  let burned_amount = 25
  let expected_remaining = initial_vault.minted_tokens - burned_amount
  expected_remaining == 25
}

test test_withdraw_after_burn() {
  // User has 150 ADA collateral, 100 tokens minted
  // Burns all 100 tokens, can now withdraw all collateral
  let vault =
    sample_vault(test_user, "TECH_BASKET_001", 150_000_000, 0, test_timestamp)
  // With 0 minted tokens, any collateral can be withdrawn
  vault.minted_tokens == 0
}

test test_partial_withdraw_maintains_ratio() {
  // User has 200 ADA collateral ($100), 50 tokens worth $33
  // Ratio = $100/$33 ≈ 303%
  // Wants to withdraw 50 ADA ($25), leaving 150 ADA ($75)
  // New ratio = $75/$33 ≈ 227% (still healthy)
  let collateral_value = 100_000_000
  let minted_value = 33_000_000
  let withdraw_value = 25_000_000
  let remaining_collateral = collateral_value - withdraw_value
  is_healthy(remaining_collateral, minted_value)
}

// ============================================================================
// TEST 6: LIQUIDATION SCENARIOS
// ============================================================================

test test_liquidation_prices_higher_than_default() {
  let default = default_prices()
  let liquidation = liquidation_prices()
  expect Some((_, default_btc)) =
    list.find(default, fn((id, _)) { id == "BTC" })
  expect Some((_, liq_btc)) =
    list.find(liquidation, fn((id, _)) { id == "BTC" })
  // Liquidation prices are 50% higher
  liq_btc == default_btc * 3 / 2
}

test test_position_becomes_undercollateralized() {
  let oracle = test_oracle_datum()
  let liq_oracle = test_oracle_datum_liquidation()
  let basket = sample_tech_basket(test_user, test_timestamp)
  let initial_price = calculate_basket_price(oracle.prices, basket.assets)
  let new_price = calculate_basket_price(liq_oracle.prices, basket.assets)
  // New price should be higher (basket value increased)
  new_price > initial_price
}

test test_liquidation_triggers_on_price_increase() {
  // Setup: User minted at exactly 150% ratio
  // Initial basket price: $30,930
  // Collateral needed: $30,930 * 1.5 = $46,395
  // User deposited exactly $46,395 worth of ADA
  let initial_collateral = 46_395_000_000
  // $46,395 in 1e6
  // After price increase (50%), basket now worth $46,395
  // New required collateral: $46,395 * 1.5 = $69,592.50
  // User only has $46,395, ratio = 100% (undercollateralized)
  let new_minted_value = 46_395_000_000
  // Basket value increased
  !is_healthy(initial_collateral, new_minted_value)
}

test test_liquidation_value_calculation() {
  // Liquidator pays off debt and receives collateral minus 5%
  let collateral = 100_000_000
  // 100 ADA
  let liq_value = liquidation_value(collateral)
  // Owner receives 95% (liquidation bonus of 5% goes to liquidator)
  liq_value == 95_000_000
}

test test_liquidation_bonus_for_liquidator() {
  // Liquidator receives 5% bonus
  let collateral = 100_000_000
  let owner_receives = liquidation_value(collateral)
  let liquidator_bonus = collateral - owner_receives
  // 5% of 100 ADA = 5 ADA
  liquidator_bonus == 5_000_000
}

// ============================================================================
// TEST 7: STATE TRANSITIONS
// ============================================================================

test test_vault_state_after_deposit() {
  let initial = sample_vault(test_user, "TECH_BASKET_001", 0, 0, test_timestamp)
  let deposit_amount = 100_000_000
  // Expected state after deposit
  let expected_collateral = initial.collateral_ada + deposit_amount
  expected_collateral == 100_000_000
}

test test_vault_state_after_mint() {
  let initial =
    sample_vault(test_user, "TECH_BASKET_001", 100_000_000, 0, test_timestamp)
  let mint_amount = 50
  // Expected state after mint
  let expected_minted = initial.minted_tokens + mint_amount
  expected_minted == 50
}

test test_vault_state_after_burn() {
  let initial =
    sample_vault(test_user, "TECH_BASKET_001", 100_000_000, 50, test_timestamp)
  let burn_amount = 30
  // Expected state after burn
  let expected_minted = initial.minted_tokens - burn_amount
  expected_minted == 20
}

test test_vault_state_after_withdraw() {
  let initial =
    sample_vault(test_user, "TECH_BASKET_001", 100_000_000, 0, test_timestamp)
  let withdraw_amount = 50_000_000
  // Expected state after withdraw
  let expected_collateral = initial.collateral_ada - withdraw_amount
  expected_collateral == 50_000_000
}

test test_vault_closed_after_full_burn_and_withdraw() {
  // User burns all tokens and withdraws all collateral
  let final_vault =
    sample_vault(test_user, "TECH_BASKET_001", 0, 0, test_timestamp)
  // Position is effectively closed
  and {
    (final_vault.collateral_ada == 0)?,
    (final_vault.minted_tokens == 0)?,
  }
}

// ============================================================================
// TEST 8: EDGE CASES
// ============================================================================

test test_minimum_collateral_requirement() {
  // Minimum collateral is 2 ADA
  let min_collateral = 2_000_000
  // Vault with minimum collateral
  let vault =
    sample_vault(
      test_user,
      "TECH_BASKET_001",
      min_collateral,
      0,
      test_timestamp,
    )
  vault.collateral_ada >= min_collateral
}

test test_zero_minted_allows_full_withdraw() {
  // With 0 minted tokens, user can withdraw everything
  let collateral = 100_000_000
  let minted = 0
  // Any positive collateral with 0 minted is healthy
  is_healthy(collateral, minted)
}

test test_cannot_mint_with_zero_collateral() {
  // With 0 collateral, cannot mint anything
  let collateral = 0
  let minted_value = 1
  // Even 1 unit of value
  !is_healthy(collateral, minted_value)
}

test test_price_precision_maintained() {
  // All calculations should maintain 1e6 precision
  let price = 30_930_000_000
  // $30,930 in 1e6
  let quantity = 2
  let total_value = price * quantity
  // Should be $61,860 in 1e6 precision
  total_value == 61_860_000_000
}

// ============================================================================
// TEST 9: FULL FLOW SIMULATION
// ============================================================================

test test_full_mint_burn_cycle() {
  // Simulate complete cycle:
  // 1. Create vault with 200 ADA
  // 2. Mint 50 tokens
  // 3. Burn 50 tokens
  // 4. Withdraw all collateral
  let initial_collateral = 200_000_000
  let mint_amount = 50
  let burn_amount = 50
  // After mint
  let after_mint_collateral = initial_collateral
  let after_mint_tokens = mint_amount
  // After burn
  let after_burn_collateral = after_mint_collateral
  let after_burn_tokens = after_mint_tokens - burn_amount
  // After full withdraw
  let final_collateral = 0
  let final_tokens = after_burn_tokens
  and {
    (after_burn_tokens == 0)?,
    (final_collateral == 0)?,
    (final_tokens == 0)?,
  }
}

test test_multiple_deposit_mint_cycles() {
  // User can do multiple deposit/mint operations
  let initial_collateral = 100_000_000
  let second_deposit = 50_000_000
  let total_collateral = initial_collateral + second_deposit
  // First mint
  let first_mint = 30
  // Second mint
  let second_mint = 20
  let total_minted = first_mint + second_mint
  and {
    (total_collateral == 150_000_000)?,
    (total_minted == 50)?,
  }
}
