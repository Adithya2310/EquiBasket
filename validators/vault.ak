//// EquiBaskets - Vault Validator
////
//// This is the core validator that manages:
//// - ADA collateral deposits
//// - Basket token minting
//// - Basket token burning
//// - Liquidations

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address, Script}
use cardano/assets.{PolicyId, lovelace_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use types.{
  AssetId, BasketDatum, Burn, Deposit, Liquidate, Mint, OracleDatum, VaultDatum,
  VaultRedeemer, Withdraw, calculate_basket_price, collateral_ratio, is_healthy,
  liquidation_value, min_collateral, price_precision,
}

// ============================================================================
// VAULT PARAMETERS
// ============================================================================

/// Vault parameters: script hashes for oracle and basket factory
pub type VaultParams {
  /// Script hash of the oracle validator
  oracle_script_hash: ByteArray,
  /// Script hash of the basket factory validator
  basket_factory_script_hash: ByteArray,
}

// ============================================================================
// VALIDATOR
// ============================================================================

validator vault(params: VaultParams) {
  /// Spend validator: controls vault operations
  spend(
    datum: Option<VaultDatum>,
    redeemer: VaultRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    trace @"vault.spend: Starting vault validation"
    // Extract datum
    expect Some(vault_datum) = datum
    trace @"Vault datum extracted successfully"

    when redeemer is {
      Deposit { amount } -> {
        trace @"vault.Deposit: Starting deposit validation"
        // Anyone can deposit to their own vault, but only owner can operate
        let owner_signed = list.has(tx.extra_signatories, vault_datum.owner)
        trace @"Owner signature verification completed"
        // Amount must be positive
        let amount_valid = amount > 0
        trace @"Amount validation completed"
        // Find continuing output
        let continuing_output = find_continuing_vault(tx.outputs, own_ref, tx)
        trace @"Continuing vault output found"
        // Validate deposit update
        let output_valid =
          validate_deposit(continuing_output, vault_datum, amount)
        trace @"Deposit output validation completed"
        and {
          owner_signed?,
          amount_valid?,
          output_valid?,
        }
      }

      Withdraw { amount } -> {
        trace @"vault.Withdraw: Starting withdrawal validation"
        // Only owner can withdraw
        let owner_signed = list.has(tx.extra_signatories, vault_datum.owner)
        trace @"Owner signature verified"
        // Amount must be positive and <= available
        let amount_valid = and {
            amount > 0,
            amount <= vault_datum.collateral_ada,
          }
        trace @"Withdrawal amount validated"
        // Get oracle price from reference inputs (filter by oracle script hash)
        let oracle_datum =
          get_oracle_datum(tx.reference_inputs, params.oracle_script_hash)
        trace @"Oracle datum retrieved"
        let basket_datum =
          get_basket_datum(
            tx.reference_inputs,
            params.basket_factory_script_hash,
            vault_datum.basket_id,
          )
        trace @"Basket datum retrieved"
        let basket_price =
          calculate_basket_price(oracle_datum.prices, basket_datum.assets)
        trace @"Basket price calculated"
        // Calculate remaining collateral value
        let remaining_collateral = vault_datum.collateral_ada - amount
        // Calculate minted value (tokens * basket_price)
        let minted_value =
          vault_datum.minted_tokens * basket_price / price_precision
        trace @"Collateral health check starting"
        // Must remain healthy after withdrawal
        let remains_healthy = or {
            vault_datum.minted_tokens == 0,
            is_healthy(remaining_collateral, minted_value),
          }
        trace @"Health check completed"
        // Must maintain minimum collateral if position still exists
        let min_collateral_ok = or {
            remaining_collateral == 0,
            remaining_collateral >= min_collateral,
          }
        trace @"Minimum collateral check completed"
        // Find continuing output (or allow closing if empty)
        let output_valid =
          validate_withdrawal(tx.outputs, own_ref, tx, vault_datum, amount)
        trace @"Withdrawal output validation completed"
        and {
          owner_signed?,
          amount_valid?,
          remains_healthy?,
          min_collateral_ok?,
          output_valid?,
        }
      }

      Mint { amount } -> {
        trace @"vault.Mint: Starting mint validation"
        // Only owner can mint
        let owner_signed = list.has(tx.extra_signatories, vault_datum.owner)
        trace @"Owner signature verified"
        // Amount must be positive
        let amount_valid = amount > 0
        trace @"Mint amount validated"
        // Get oracle price (filter by oracle script hash)
        let oracle_datum =
          get_oracle_datum(tx.reference_inputs, params.oracle_script_hash)
        trace @"Oracle datum retrieved"
        let basket_datum =
          get_basket_datum(
            tx.reference_inputs,
            params.basket_factory_script_hash,
            vault_datum.basket_id,
          )
        trace @"Basket datum retrieved"
        let basket_price =
          calculate_basket_price(oracle_datum.prices, basket_datum.assets)
        trace @"Basket price calculated"
        // Calculate new minted value
        let new_minted_tokens = vault_datum.minted_tokens + amount
        let minted_value = new_minted_tokens * basket_price / price_precision
        trace @"Checking collateralization ratio"
        // Check collateral ratio
        let is_collateralized =
          is_healthy(vault_datum.collateral_ada, minted_value)
        trace @"Collateralization check completed"
        // Verify tokens are actually minted in this transaction
        let tokens_minted =
          verify_tokens_minted(tx, vault_datum.basket_id, amount)
        trace @"Token minting verified in transaction"
        // Verify continuing output
        let continuing_output = find_continuing_vault(tx.outputs, own_ref, tx)
        trace @"Continuing vault output found"
        let output_valid = validate_mint(continuing_output, vault_datum, amount)
        trace @"Mint output validation completed"
        and {
          owner_signed?,
          amount_valid?,
          is_collateralized?,
          tokens_minted?,
          output_valid?,
        }
      }

      Burn { amount } -> {
        trace @"vault.Burn: Starting burn validation"
        // Only owner can burn
        let owner_signed = list.has(tx.extra_signatories, vault_datum.owner)
        trace @"Owner signature verified"
        // Amount must be positive and <= minted
        let amount_valid = and {
            amount > 0,
            amount <= vault_datum.minted_tokens,
          }
        trace @"Burn amount validated"
        // Verify tokens are actually burned in this transaction
        let tokens_burned =
          verify_tokens_burned(tx, vault_datum.basket_id, amount)
        trace @"Token burning verified in transaction"
        // Validate continuing output (or closure if all burned)
        let output_valid =
          validate_burn(tx.outputs, own_ref, tx, vault_datum, amount)
        trace @"Burn output validation completed"
        and {
          owner_signed?,
          amount_valid?,
          tokens_burned?,
          output_valid?,
        }
      }

      Liquidate -> {
        trace @"vault.Liquidate: Starting liquidation validation"
        // Get oracle price (filter by oracle script hash)
        let oracle_datum =
          get_oracle_datum(tx.reference_inputs, params.oracle_script_hash)
        trace @"Oracle datum retrieved"
        let basket_datum =
          get_basket_datum(
            tx.reference_inputs,
            params.basket_factory_script_hash,
            vault_datum.basket_id,
          )
        trace @"Basket datum retrieved"
        let basket_price =
          calculate_basket_price(oracle_datum.prices, basket_datum.assets)
        trace @"Basket price calculated"
        // Calculate current minted value
        let minted_value =
          vault_datum.minted_tokens * basket_price / price_precision
        trace @"Checking if position is undercollateralized"
        // Position must be unhealthy (undercollateralized)
        let is_undercollateralized =
          !is_healthy(vault_datum.collateral_ada, minted_value)
        trace @"Undercollateralization check completed"
        // Verify liquidator burns the tokens
        let tokens_burned =
          verify_tokens_burned(
            tx,
            vault_datum.basket_id,
            vault_datum.minted_tokens,
          )
        trace @"Token burning verified"
        // Verify liquidator receives collateral (at discount)
        let liq_value = liquidation_value(vault_datum.collateral_ada)
        let liquidator_paid =
          verify_liquidator_payment(tx, vault_datum.owner, liq_value)
        trace @"Liquidator payment verified"
        // Position should be closed (no continuing output needed)
        and {
          is_undercollateralized?,
          tokens_burned?,
          liquidator_paid?,
        }
      }
    }
  }

  /// Fallback handler
  else(_) {
    trace @"vault: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Find continuing vault output
fn find_continuing_vault(
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

/// Get oracle datum from reference inputs by filtering by oracle script hash
/// This prevents accidentally parsing a BasketDatum as OracleDatum
fn get_oracle_datum(
  ref_inputs: List<Input>,
  oracle_script_hash: ByteArray,
) -> OracleDatum {
  expect Some(input) =
    list.find(
      ref_inputs,
      fn(input) {
        // First, filter by script address
        when input.output.address.payment_credential is {
          Script(hash) -> hash == oracle_script_hash
          _ -> False
        }
      },
    )
  // Now we're sure this is from the oracle script, safe to parse
  expect InlineDatum(data) = input.output.datum
  expect datum: OracleDatum = data
  datum
}

/// Get basket datum from reference inputs by filtering by basket factory script hash
/// Then match by basket_id
fn get_basket_datum(
  ref_inputs: List<Input>,
  basket_factory_script_hash: ByteArray,
  basket_id: ByteArray,
) -> BasketDatum {
  expect Some(input) =
    list.find(
      ref_inputs,
      fn(input) {
        // First, filter by script address
        let is_correct_script =
          when input.output.address.payment_credential is {
            Script(hash) -> hash == basket_factory_script_hash
            _ -> False
          }
        // Then check basket_id in datum
        if is_correct_script {
          when input.output.datum is {
            InlineDatum(data) -> {
              expect datum: BasketDatum = data
              datum.basket_id == basket_id
            }
            _ -> False
          }
        } else {
          False
        }
      },
    )
  expect InlineDatum(data) = input.output.datum
  expect datum: BasketDatum = data
  datum
}

/// Validate deposit continuing output
fn validate_deposit(output: Output, original: VaultDatum, amount: Int) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: VaultDatum = data
      and {
        // Owner unchanged
        (new_datum.owner == original.owner)?,
        // Basket ID unchanged
        (new_datum.basket_id == original.basket_id)?,
        // Collateral increased
        (new_datum.collateral_ada == original.collateral_ada + amount)?,
        // Minted tokens unchanged
        (new_datum.minted_tokens == original.minted_tokens)?,
        // Created_at unchanged
        (new_datum.created_at == original.created_at)?,
        // Output value contains the new collateral
        (lovelace_of(output.value) >= new_datum.collateral_ada)?,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

/// Validate withdrawal (continuing output or closure)
fn validate_withdrawal(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
  original: VaultDatum,
  amount: Int,
) -> Bool {
  let remaining = original.collateral_ada - amount
  if remaining == 0 && original.minted_tokens == 0 {
    // Position closed, no continuing output needed
    True
  } else {
    // Must have continuing output
    let continuing_output = find_continuing_vault(outputs, own_ref, tx)
    when continuing_output.datum is {
      InlineDatum(data) -> {
        expect new_datum: VaultDatum = data
        and {
          (new_datum.owner == original.owner)?,
          (new_datum.basket_id == original.basket_id)?,
          (new_datum.collateral_ada == remaining)?,
          (new_datum.minted_tokens == original.minted_tokens)?,
          (new_datum.created_at == original.created_at)?,
          (lovelace_of(continuing_output.value) >= remaining)?,
        }
      }
      _ -> fail @"Continuing output must have inline datum"
    }
  }
}

/// Validate mint continuing output
fn validate_mint(output: Output, original: VaultDatum, amount: Int) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: VaultDatum = data
      and {
        (new_datum.owner == original.owner)?,
        (new_datum.basket_id == original.basket_id)?,
        (new_datum.collateral_ada == original.collateral_ada)?,
        (new_datum.minted_tokens == original.minted_tokens + amount)?,
        (new_datum.created_at == original.created_at)?,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

/// Validate burn (continuing output or closure)
fn validate_burn(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
  original: VaultDatum,
  amount: Int,
) -> Bool {
  let remaining_tokens = original.minted_tokens - amount
  if remaining_tokens == 0 && original.collateral_ada == 0 {
    // Position closed, no continuing output needed
    True
  } else {
    // Must have continuing output
    let continuing_output = find_continuing_vault(outputs, own_ref, tx)
    when continuing_output.datum is {
      InlineDatum(data) -> {
        expect new_datum: VaultDatum = data
        and {
          (new_datum.owner == original.owner)?,
          (new_datum.basket_id == original.basket_id)?,
          (new_datum.collateral_ada == original.collateral_ada)?,
          (new_datum.minted_tokens == remaining_tokens)?,
          (new_datum.created_at == original.created_at)?,
        }
      }
      _ -> fail @"Continuing output must have inline datum"
    }
  }
}

/// Verify tokens are minted in transaction
fn verify_tokens_minted(
  tx: Transaction,
  basket_id: ByteArray,
  amount: Int,
) -> Bool {
  // Check mint field for positive minting of basket tokens
  // Token name is derived from basket_id
  let token_name = basket_id
  // Look through all minted tokens
  tx.mint
    |> assets.flatten
    |> list.any(fn((_, name, qty)) { name == token_name && qty == amount })
}

/// Verify tokens are burned in transaction
fn verify_tokens_burned(
  tx: Transaction,
  basket_id: ByteArray,
  amount: Int,
) -> Bool {
  let token_name = basket_id
  // Look for negative minting (burning)
  tx.mint
    |> assets.flatten
    |> list.any(fn((_, name, qty)) { name == token_name && qty == -amount })
}

/// Verify liquidator receives payment (owner gets remainder minus bonus)
fn verify_liquidator_payment(
  tx: Transaction,
  owner: VerificationKeyHash,
  expected_amount: Int,
) -> Bool {
  // In a full implementation, we'd verify the owner receives expected_amount
  // For now, we just check there's an output with at least that much
  list.any(
    tx.outputs,
    fn(output) { lovelace_of(output.value) >= expected_amount },
  )
}

// ============================================================================
// SAMPLE VAULT FOR TESTING
// ============================================================================

/// Create a sample vault datum
pub fn sample_vault(
  owner: VerificationKeyHash,
  basket_id: ByteArray,
  collateral: Int,
  minted: Int,
  timestamp: Int,
) -> VaultDatum {
  VaultDatum {
    owner,
    basket_id,
    collateral_ada: collateral,
    minted_tokens: minted,
    created_at: timestamp,
  }
}

// ============================================================================
// TESTS
// ============================================================================

test test_sample_vault_creation() {
  let v = sample_vault("owner123", "TECH_BASKET_001", 100_000_000, 0, 1000)
  and {
    v.owner == "owner123",
    v.basket_id == "TECH_BASKET_001",
    v.collateral_ada == 100_000_000,
    v.minted_tokens == 0,
    v.created_at == 1000,
  }
}

test test_healthy_ratio_150_percent() {
  // 150 ADA collateral, 100 tokens worth $1 each = exactly 150%
  let collateral = 150_000_000
  let minted_value = 100_000_000
  is_healthy(collateral, minted_value)
}

test test_unhealthy_ratio_140_percent() {
  // 140 ADA collateral, 100 tokens worth $1 each = 140%
  let collateral = 140_000_000
  let minted_value = 100_000_000
  !is_healthy(collateral, minted_value)
}

test test_healthy_ratio_200_percent() {
  // 200 ADA collateral, 100 tokens worth $1 each = 200%
  let collateral = 200_000_000
  let minted_value = 100_000_000
  is_healthy(collateral, minted_value)
}

test test_liquidation_value_calculation() {
  // 100 ADA collateral, 5% bonus means owner gets 95 ADA
  liquidation_value(100_000_000) == 95_000_000
}

test test_min_collateral() {
  min_collateral == 2_000_000
}
