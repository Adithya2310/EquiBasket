//// EquiBaskets - LP Token Minting Policy
////
//// Controls minting and burning of LP (Liquidity Provider) tokens.
//// LP tokens represent proportional ownership of a liquidity pool.

use aiken/collection/list
use cardano/address.{Script}
use cardano/assets
use cardano/transaction.{InlineDatum, Mint, OutputReference, Transaction}
use liquidity_pool_types.{
  BurnLpTokens, LpMintAction, LpMintRedeemer, MintLpTokens, PoolDatum,
}

// ============================================================================
// VALIDATOR
// ============================================================================

validator lp_token_policy {
  /// Minting policy: controls LP token minting/burning
  mint(redeemer: LpMintRedeemer, _policy_id: ByteArray, tx: Transaction) {
    trace @"lp_token_policy.mint: Starting validation"
    
    // Extract redeemer fields
    let LpMintRedeemer { action, pool_ref } = redeemer
    
    trace @"Finding pool input"
    // Find the pool input being spent
    expect Some(pool_input) =
      list.find(tx.inputs, fn(input) { input.output_reference == pool_ref })
    
    trace @"Verifying input is from pool script"
    // Verify input is from a script (the pool validator)
    let is_script_input =
      when pool_input.output.address.payment_credential is {
        Script(_hash) -> True
        _ -> False
      }
    
    trace @"Extracting pool datum"
    // Extract pool datum
    expect InlineDatum(pool_data) = pool_input.output.datum
    expect pool_datum: PoolDatum = pool_data
    
    trace @"Extracting minted tokens"
    // Get minted tokens from this policy
    let minted_tokens = get_minted_tokens(tx, pool_datum.basket_id)
    
    trace @"Validating action"
    // Validate based on action
    let action_valid =
      when action is {
        MintLpTokens -> {
          trace @"MintLpTokens: Checking positive quantity"
          // Minting: quantity must be positive
          when minted_tokens is {
            [Pair(_token_name, quantity)] -> quantity > 0
            _ -> False
          }
        }
        BurnLpTokens -> {
          trace @"BurnLpTokens: Checking negative quantity"
          // Burning: quantity must be negative
          when minted_tokens is {
            [Pair(_token_name, quantity)] -> quantity < 0
            _ -> False
          }
        }
      }
    
    trace @"Completing validation"
    and {
      is_script_input?,
      action_valid?,
    }
  }
  
  /// Fallback handler
  else(_) {
    trace @"lp_token_policy: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get minted tokens for this policy with LP token name
fn get_minted_tokens(
  tx: Transaction,
  basket_id: ByteArray,
) -> List<Pair<ByteArray, Int>> {
  let lp_token_name = build_lp_token_name(basket_id)
  
  // Filter minted tokens to only LP tokens for this basket
  tx.mint
    |> assets.flatten
    |> list.filter(fn((_, name, _qty)) { name == lp_token_name })
    |> list.map(fn((_, name, qty)) { Pair(name, qty) })
}

/// Build LP token name from basket ID
/// LP tokens use the same name as basket tokens
/// They are distinguished by their different policy ID
fn build_lp_token_name(basket_id: ByteArray) -> ByteArray {
  basket_id
}

// ============================================================================
// TESTS
// ============================================================================

test test_build_lp_token_name() {
  build_lp_token_name("TECH_BASKET") == "TECH_BASKET"
}
