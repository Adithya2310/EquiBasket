//// EquiBaskets - Liquidity Pool Validator
////
//// This validator implements a constant product AMM (Automated Market Maker)
//// for trading synthetic basket tokens against ADA.
////
//// Formula: x * y = k (constant product)
//// - Swaps maintain the invariant (with fees)
//// - Liquidity providers receive LP tokens representing pool ownership

use aiken/collection/list
use cardano/address.{Script}
use cardano/assets
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use liquidity_pool_types.{
  AddLiquidity, CreatePool, LpMintRedeemer, PoolDatum, PoolRedeemer,
  RemoveLiquidity, SwapAdaForBasket, SwapBasketForAda, calculate_lp_tokens,
  calculate_swap_output, calculate_withdrawal_amounts, min_liquidity,
  verify_k_invariant,
}

// ============================================================================
// POOL PARAMETERS
// ============================================================================

/// Pool parameters: script hash for basket factory (to verify basket exists)
pub type PoolParams {
  /// Script hash of the basket factory validator
  basket_factory_script_hash: ByteArray,
}

// ============================================================================
// VALIDATOR
// ============================================================================

validator liquidity_pool(params: PoolParams) {
  /// Spend validator: controls pool operations
  spend(
    datum: Option<PoolDatum>,
    redeemer: PoolRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    trace @"liquidity_pool.spend: Starting pool validation"
    
    // Extract datum
    expect Some(pool_datum) = datum
    trace @"Pool datum extracted successfully"
    
    when redeemer is {
      CreatePool { initial_basket, initial_ada } -> {
        trace @"CreatePool: Validating pool creation"
        
        // Initial amounts must be positive
        let amounts_valid = and {
            initial_basket > 0,
            initial_ada > 0,
          }
        trace @"Initial amounts validated"
        
        // Calculate initial LP tokens
        let initial_lp = sqrt(initial_basket * initial_ada)
        let lp_to_mint = initial_lp - min_liquidity
        
        trace @"Initial LP tokens calculated"
        
        // Verify LP tokens are minted
        let lp_tokens_minted =
          verify_lp_tokens_minted(tx, pool_datum.basket_id, lp_to_mint)
        trace @"LP token minting verified"
        
        // Verify initial datum is correct
        let datum_valid = and {
            pool_datum.basket_reserve == initial_basket,
            pool_datum.ada_reserve == initial_ada,
            pool_datum.lp_token_supply == initial_lp,
          }
        trace @"Initial datum validated"
        
        and {
          amounts_valid?,
          lp_tokens_minted?,
          datum_valid?,
        }
      }
      
      AddLiquidity { basket_amount, ada_amount, min_lp_tokens } -> {
        trace @"AddLiquidity: Validating liquidity addition"
        
        // Amounts must be positive
        let amounts_valid = and {
            basket_amount > 0,
            ada_amount > 0,
            min_lp_tokens > 0,
          }
        trace @"Amounts validated"
        
        // Calculate LP tokens to mint
        let lp_tokens =
          calculate_lp_tokens(
            basket_amount,
            ada_amount,
            pool_datum.basket_reserve,
            pool_datum.ada_reserve,
            pool_datum.lp_token_supply,
          )
        
        trace @"LP tokens calculated"
        
        // Check slippage protection
        let slippage_ok = lp_tokens >= min_lp_tokens
        trace @"Slippage protection checked"
        
        // Verify LP tokens are minted
        let lp_tokens_minted =
          verify_lp_tokens_minted(tx, pool_datum.basket_id, lp_tokens)
        trace @"LP tokens minted"
        
        // Find continuing pool output
        let continuing_output = find_continuing_pool(tx.outputs, own_ref, tx)
        trace @"Continuing pool output found"
        
        // Validate updated pool state
        let output_valid =
          validate_add_liquidity(
            continuing_output,
            pool_datum,
            basket_amount,
            ada_amount,
            lp_tokens,
          )
        trace @"Pool state validated"
        
        and {
          amounts_valid?,
          slippage_ok?,
          lp_tokens_minted?,
          output_valid?,
        }
      }
      
      RemoveLiquidity { lp_tokens, min_basket, min_ada } -> {
        trace @"RemoveLiquidity: Validating liquidity removal"
        
        // LP tokens must be positive and <= supply
        let lp_valid = and {
            lp_tokens > 0,
            lp_tokens <= pool_datum.lp_token_supply,
          }
        trace @"LP tokens validated"
        
        // Calculate withdrawal amounts
        let (basket_out, ada_out) =
          calculate_withdrawal_amounts(
            lp_tokens,
            pool_datum.basket_reserve,
            pool_datum.ada_reserve,
            pool_datum.lp_token_supply,
          )
        
        trace @"Withdrawal amounts calculated"
        
        // Check slippage protection
        let slippage_ok = and {
            basket_out >= min_basket,
            ada_out >= min_ada,
          }
        trace @"Slippage protection checked"
        
        // Verify LP tokens are burned
        let lp_tokens_burned =
          verify_lp_tokens_burned(tx, pool_datum.basket_id, lp_tokens)
        trace @"LP tokens burned"
        
        // Validate continuing output or closure
        let output_valid =
          validate_remove_liquidity(
            tx.outputs,
            own_ref,
            tx,
            pool_datum,
            lp_tokens,
          )
        trace @"Pool state validated"
        
        and {
          lp_valid?,
          slippage_ok?,
          lp_tokens_burned?,
          output_valid?,
        }
      }
      
      SwapBasketForAda { basket_in, min_ada_out } -> {
        trace @"SwapBasketForAda: Validating basket -> ADA swap"
        
        // Input must be positive
        let input_valid = basket_in > 0
        trace @"Input validated"
        
        // Calculate output using constant product formula
        let ada_out =
          calculate_swap_output(
            basket_in,
            pool_datum.basket_reserve,
            pool_datum.ada_reserve,
          )
        
        trace @"Output calculated"
        
        // Check slippage protection
        let slippage_ok = ada_out >= min_ada_out
        trace @"Slippage protection checked"
        
        // Find continuing pool output
        let continuing_output = find_continuing_pool(tx.outputs, own_ref, tx)
        trace @"Continuing pool output found"
        
        // Validate swap: reserves updated correctly
        let output_valid =
          validate_swap(
            continuing_output,
            pool_datum,
            pool_datum.basket_reserve + basket_in,
            pool_datum.ada_reserve - ada_out,
          )
        trace @"Swap state validated"
        
        and {
          input_valid?,
          slippage_ok?,
          output_valid?,
        }
      }
      
      SwapAdaForBasket { ada_in, min_basket_out } -> {
        trace @"SwapAdaForBasket: Validating ADA -> basket swap"
        
        // Input must be positive
        let input_valid = ada_in > 0
        trace @"Input validated"
        
        // Calculate output using constant product formula
        let basket_out =
          calculate_swap_output(
            ada_in,
            pool_datum.ada_reserve,
            pool_datum.basket_reserve,
          )
        
        trace @"Output calculated"
        
        // Check slippage protection
        let slippage_ok = basket_out >= min_basket_out
        trace @"Slippage protection checked"
        
        // Find continuing pool output
        let continuing_output = find_continuing_pool(tx.outputs, own_ref, tx)
        trace @"Continuing pool output found"
        
        // Validate swap: reserves updated correctly
        let output_valid =
          validate_swap(
            continuing_output,
            pool_datum,
            pool_datum.basket_reserve - basket_out,
            pool_datum.ada_reserve + ada_in,
          )
        trace @"Swap state validated"
        
        and {
          input_valid?,
          slippage_ok?,
          output_valid?,
        }
      }
    }
  }
  
  /// Fallback handler
  else(_) {
    trace @"liquidity_pool: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Find continuing pool output
fn find_continuing_pool(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
) -> Output {
  expect Some(own_input) =
    list.find(tx.inputs, fn(input) { input.output_reference == own_ref })
  expect Script(own_hash) = own_input.output.address.payment_credential
  
  expect Some(output) =
    list.find(
      outputs,
      fn(output) {
        when output.address.payment_credential is {
          Script(hash) -> hash == own_hash
          _ -> False
        }
      },
    )
  output
}

/// Validate add liquidity continuing output
fn validate_add_liquidity(
  output: Output,
  original: PoolDatum,
  basket_amount: Int,
  ada_amount: Int,
  lp_tokens: Int,
) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: PoolDatum = data
      and {
        // Basket ID unchanged
        (new_datum.basket_id == original.basket_id)?,
        // Reserves increased
        (new_datum.basket_reserve == original.basket_reserve + basket_amount)?,
        (new_datum.ada_reserve == original.ada_reserve + ada_amount)?,
        // LP supply increased
        (new_datum.lp_token_supply == original.lp_token_supply + lp_tokens)?,
        // Created_at unchanged
        (new_datum.created_at == original.created_at)?,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

/// Validate remove liquidity (continuing output or closure)
fn validate_remove_liquidity(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
  original: PoolDatum,
  lp_tokens: Int,
) -> Bool {
  let remaining_lp = original.lp_token_supply - lp_tokens
  
  if remaining_lp == 0 {
    // Pool closed (all LP tokens burned)
    True
  } else {
    // Must have continuing output
    let continuing_output = find_continuing_pool(outputs, own_ref, tx)
    when continuing_output.datum is {
      InlineDatum(data) -> {
        expect new_datum: PoolDatum = data
        
        // Calculate expected reserves after withdrawal
        let (basket_out, ada_out) =
          calculate_withdrawal_amounts(
            lp_tokens,
            original.basket_reserve,
            original.ada_reserve,
            original.lp_token_supply,
          )
        
        and {
          (new_datum.basket_id == original.basket_id)?,
          (new_datum.basket_reserve == original.basket_reserve - basket_out)?,
          (new_datum.ada_reserve == original.ada_reserve - ada_out)?,
          (new_datum.lp_token_supply == remaining_lp)?,
          (new_datum.created_at == original.created_at)?,
        }
      }
      _ -> fail @"Continuing output must have inline datum"
    }
  }
}

/// Validate swap: reserves updated and k invariant maintained
fn validate_swap(
  output: Output,
  original: PoolDatum,
  new_basket_reserve: Int,
  new_ada_reserve: Int,
) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: PoolDatum = data
      
      // Verify k invariant (with fee, k should increase slightly)
      let k_valid =
        verify_k_invariant(
          original.basket_reserve,
          original.ada_reserve,
          new_basket_reserve,
          new_ada_reserve,
        )
      
      and {
        (new_datum.basket_id == original.basket_id)?,
        (new_datum.basket_reserve == new_basket_reserve)?,
        (new_datum.ada_reserve == new_ada_reserve)?,
        (new_datum.lp_token_supply == original.lp_token_supply)?,
        (new_datum.created_at == original.created_at)?,
        k_valid?,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

/// Verify LP tokens are minted in transaction
fn verify_lp_tokens_minted(
  tx: Transaction,
  basket_id: ByteArray,
  amount: Int,
) -> Bool {
  // LP token name is "LP-" + basket_id
  let lp_token_name = build_lp_token_name(basket_id)
  
  // Look through all minted tokens
  tx.mint
    |> assets.flatten
    |> list.any(fn((_, name, qty)) { name == lp_token_name && qty == amount })
}

/// Verify LP tokens are burned in transaction
fn verify_lp_tokens_burned(
  tx: Transaction,
  basket_id: ByteArray,
  amount: Int,
) -> Bool {
  let lp_token_name = build_lp_token_name(basket_id)
  
  // Look for negative minting (burning)
  tx.mint
    |> assets.flatten
    |> list.any(fn((_, name, qty)) { name == lp_token_name && qty == -amount })
}

/// Build LP token name from basket ID
/// For simplicity, LP tokens use the same name as basket tokens
/// In practice, LP tokens are distinguished by their policy ID
fn build_lp_token_name(basket_id: ByteArray) -> ByteArray {
  basket_id
}

/// Integer square root (copied from types for use here)
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

// ============================================================================
// TESTS
// ============================================================================

test test_build_lp_token_name() {
  build_lp_token_name("TECH_BASKET") == "TECH_BASKET"
}
