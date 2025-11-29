//// EquiBaskets - Liquidity Pool Shared Type Definitions
//// 
//// This module contains shared types for the liquidity pool AMM implementation.

use cardano/transaction.{OutputReference}

// ============================================================================
// CONSTANTS
// ============================================================================

/// Fee precision: 1000 basis points = 1 = 100%
pub const fee_precision: Int = 1000

/// Swap fee: 3 basis points = 0.3%
pub const swap_fee: Int = 3

/// Minimum liquidity locked forever (to prevent division by zero)
pub const min_liquidity: Int = 1000

// ============================================================================
// POOL TYPES
// ============================================================================

/// Liquidity pool datum storing pool state
pub type PoolDatum {
  /// Associated basket ID
  basket_id: ByteArray,
  /// Basket token reserve (in token units)
  basket_reserve: Int,
  /// ADA reserve (in lovelace)
  ada_reserve: Int,
  /// Total LP tokens minted
  lp_token_supply: Int,
  /// Pool creation timestamp
  created_at: Int,
}

/// Liquidity pool redeemer actions
pub type PoolRedeemer {
  /// Create a new liquidity pool with initial liquidity
  CreatePool { initial_basket: Int, initial_ada: Int }
  /// Add liquidity to the pool
  AddLiquidity {
    basket_amount: Int,
    ada_amount: Int,
    min_lp_tokens: Int,
  }
  /// Remove liquidity from the pool
  RemoveLiquidity { lp_tokens: Int, min_basket: Int, min_ada: Int }
  /// Swap basket tokens for ADA
  SwapBasketForAda { basket_in: Int, min_ada_out: Int }
  /// Swap ADA for basket tokens
  SwapAdaForBasket { ada_in: Int, min_basket_out: Int }
}

// ============================================================================
// LP TOKEN MINTING POLICY TYPES
// ============================================================================

/// LP token minting action
pub type LpMintAction {
  /// Mint LP tokens (add liquidity or create pool)
  MintLpTokens
  /// Burn LP tokens (remove liquidity)
  BurnLpTokens
}

/// LP token minting policy redeemer
pub type LpMintRedeemer {
  /// Mint or burn action
  action: LpMintAction,
  /// Reference to the Pool UTxO authorizing this mint/burn
  pool_ref: OutputReference,
}

// ============================================================================
// HELPER FUNCTIONS - AMM CALCULATIONS
// ============================================================================

/// Calculate output amount for a swap using constant product formula
/// Applies 0.3% fee to input amount
/// Formula: output = (output_reserve * input_with_fee) / (input_reserve + input_with_fee)
/// where input_with_fee = input * (1000 - 3) / 1000 = input * 997 / 1000
pub fn calculate_swap_output(
  input_amount: Int,
  input_reserve: Int,
  output_reserve: Int,
) -> Int {
  // Apply fee: input_with_fee = input * 997 / 1000
  let input_with_fee = input_amount * ( fee_precision - swap_fee )
  
  // Calculate output: (output_reserve * input_with_fee) / (input_reserve * 1000 + input_with_fee)
  let numerator = output_reserve * input_with_fee
  let denominator = input_reserve * fee_precision + input_with_fee
  
  numerator / denominator
}

/// Calculate LP tokens to mint when adding liquidity
/// For first liquidity: sqrt(basket_amount * ada_amount) - MINIMUM_LIQUIDITY
/// For subsequent: min(basket_amount * lp_supply / basket_reserve, ada_amount * lp_supply / ada_reserve)
pub fn calculate_lp_tokens(
  basket_amount: Int,
  ada_amount: Int,
  basket_reserve: Int,
  ada_reserve: Int,
  lp_supply: Int,
) -> Int {
  if lp_supply == 0 {
    // First liquidity: geometric mean minus minimum liquidity
    let initial_liquidity = sqrt(basket_amount * ada_amount)
    initial_liquidity - min_liquidity
  } else {
    // Subsequent liquidity: proportional to existing reserves
    let basket_lp = basket_amount * lp_supply / basket_reserve
    let ada_lp = ada_amount * lp_supply / ada_reserve
    // Take minimum to ensure both reserves are proportional
    if basket_lp < ada_lp {
      basket_lp
    } else {
      ada_lp
    }
  }
}

/// Calculate basket and ADA amounts to return when removing liquidity
/// basket_out = lp_tokens * basket_reserve / lp_supply
/// ada_out = lp_tokens * ada_reserve / lp_supply
pub fn calculate_withdrawal_amounts(
  lp_tokens: Int,
  basket_reserve: Int,
  ada_reserve: Int,
  lp_supply: Int,
) -> (Int, Int) {
  let basket_out = lp_tokens * basket_reserve / lp_supply
  let ada_out = lp_tokens * ada_reserve / lp_supply
  (basket_out, ada_out)
}

/// Integer square root using Newton's method
/// Used for initial LP token calculation
fn sqrt(x: Int) -> Int {
  if x == 0 {
    0
  } else {
    do_sqrt(x, x)
  }
}

fn do_sqrt(x: Int, guess: Int) -> Int {
  let next_guess = ( guess + x / guess ) / 2
  if next_guess >= guess {
    guess
  } else {
    do_sqrt(x, next_guess)
  }
}

/// Verify constant product invariant is maintained
/// k_new >= k_old (allowing for rounding)
pub fn verify_k_invariant(
  old_basket: Int,
  old_ada: Int,
  new_basket: Int,
  new_ada: Int,
) -> Bool {
  let k_old = old_basket * old_ada
  let k_new = new_basket * new_ada
  k_new >= k_old
}

// ============================================================================
// TESTS
// ============================================================================

test test_swap_fee_constants() {
  and {
    fee_precision == 1000,
    swap_fee == 3,
  }
}

test test_calculate_swap_output() {
  // Pool: 1000 basket, 500 ADA
  // Swap in 10 basket
  // input_with_fee = 10 * 997 / 1000 = 9.97
  // output = (500 * 9.97) / (1000 + 9.97) ≈ 4.94 ADA
  let output = calculate_swap_output(10, 1000, 500)
  // Expected: (500 * 9970) / (1000000 + 9970) = 4985000 / 1009970 ≈ 4
  output == 4
}

test test_sqrt_basic() {
  and {
    sqrt(0) == 0,
    sqrt(1) == 1,
    sqrt(4) == 2,
    sqrt(9) == 3,
    sqrt(16) == 4,
    sqrt(100) == 10,
  }
}

test test_calculate_lp_tokens_initial() {
  // First liquidity: sqrt(1000 * 1000) - 1000 = 31622 - 1000 = 30622
  // Actually sqrt(1000000) = 1000, so 1000 - 1000 = 0
  // Let's use larger amounts: sqrt(1000000 * 1000000) = 1000000
  let lp = calculate_lp_tokens(1_000_000, 1_000_000, 0, 0, 0)
  lp == 1_000_000 - min_liquidity
}

test test_calculate_lp_tokens_subsequent() {
  // Pool has: 1000 basket, 500 ADA, 700 LP supply
  // Add: 100 basket, 50 ADA
  // basket_lp = 100 * 700 / 1000 = 70
  // ada_lp = 50 * 700 / 500 = 70
  // min(70, 70) = 70
  let lp = calculate_lp_tokens(100, 50, 1000, 500, 700)
  lp == 70
}

test test_calculate_withdrawal() {
  // Pool: 1000 basket, 500 ADA, 700 LP supply
  // Burn: 70 LP tokens
  // basket_out = 70 * 1000 / 700 = 100
  // ada_out = 70 * 500 / 700 = 50
  let (basket, ada) = calculate_withdrawal_amounts(70, 1000, 500, 700)
  and {
    basket == 100,
    ada == 50,
  }
}

test test_k_invariant() {
  // Old pool: 1000 * 500 = 500000
  // New pool: 1010 * 495 = 499950 (should fail, k decreased)
  // New pool: 1010 * 496 = 500960 (should pass, k increased)
  and {
    !verify_k_invariant(1000, 500, 1010, 495),
    verify_k_invariant(1000, 500, 1010, 496),
  }
}
