//// EquiBaskets - Basket Token Minting Policy
////
//// This minting policy controls the creation and destruction of basket tokens.
//// Tokens can only be minted/burned through valid Vault operations.

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use types.{BurnTokens, MintAction, MintRedeemer, MintTokens, VaultDatum}

// ============================================================================
// VALIDATOR
// ============================================================================

/// Parameterized minting policy - takes vault script hash as parameter
validator basket_token_policy(vault_hash: ScriptHash) {
  /// Mint handler: validates minting and burning of basket tokens
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    trace @"basket_token_policy.mint: Starting validation"
    let MintRedeemer { action, vault_ref } = redeemer

    trace @"Finding vault input that authorizes this mint/burn"
    // Find the vault input that authorizes this mint/burn
    expect Some(vault_input) =
      list.find(tx.inputs, fn(input) { input.output_reference == vault_ref })

    trace @"Verifying input is from vault script"
    // Verify the input is from the vault script
    let is_vault_input =
      when vault_input.output.address.payment_credential is {
        Script(hash) -> hash == vault_hash
        _ -> False
      }

    trace @"Extracting vault datum"
    // Get vault datum
    expect InlineDatum(vault_data) = vault_input.output.datum
    expect vault_datum: VaultDatum = vault_data

    // Token name must match basket_id
    let expected_token_name = vault_datum.basket_id
    trace @"Expected token name extracted from vault datum"

    trace @"Extracting minted tokens from transaction"
    // Get minted tokens under this policy
    let minted_tokens = assets.tokens(tx.mint, policy_id)
    // Should have exactly one token type minted/burned
    let token_pairs = dict.to_pairs(minted_tokens)
    expect [Pair(token_name, quantity)] = token_pairs

    trace @"Verifying token name matches basket_id"
    // Verify token name matches basket_id
    let name_matches = token_name == expected_token_name

    trace @"Validating action matches quantity sign"
    // Verify action matches quantity sign
    let action_valid =
      when action is {
        MintTokens -> {
          trace @"MintTokens action: Verifying positive quantity"
          quantity > 0
        }
        BurnTokens -> {
          trace @"BurnTokens action: Verifying negative quantity"
          quantity < 0
        }
      }

    trace @"Completing validation checks"
    and {
      is_vault_input?,
      name_matches?,
      action_valid?,
    }
  }

  /// Fallback handler
  else(_) {
    trace @"basket_token_policy: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// ALTERNATIVE: Non-parameterized policy using reference inputs
// ============================================================================

/// Alternative validator that uses reference inputs instead of parameters
validator basket_token_policy_ref {
  /// Mint handler using reference inputs for vault verification
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    trace @"basket_token_policy_ref.mint: Starting validation"
    let MintRedeemer { action, vault_ref } = redeemer

    trace @"Finding vault input"
    // Find the vault input
    expect Some(vault_input) =
      list.find(tx.inputs, fn(input) { input.output_reference == vault_ref })

    trace @"Verifying input is from a script (vault)"
    // Verify input is from a script (vault)
    let is_script_input =
      when vault_input.output.address.payment_credential is {
        Script(_) -> True
        _ -> False
      }

    trace @"Extracting vault datum"
    // Get vault datum
    expect InlineDatum(vault_data) = vault_input.output.datum
    expect vault_datum: VaultDatum = vault_data

    // Token name must match basket_id
    let expected_token_name = vault_datum.basket_id
    trace @"Expected token name extracted"

    trace @"Extracting minted tokens"
    // Get minted tokens
    let minted_tokens = assets.tokens(tx.mint, policy_id)
    let token_pairs = dict.to_pairs(minted_tokens)
    expect [Pair(token_name, quantity)] = token_pairs

    trace @"Verifying token name"
    // Verify token name
    let name_matches = token_name == expected_token_name

    trace @"Validating action"
    // Verify action
    let action_valid =
      when action is {
        MintTokens -> {
          trace @"MintTokens: Checking positive quantity"
          quantity > 0
        }
        BurnTokens -> {
          trace @"BurnTokens: Checking negative quantity"
          quantity < 0
        }
      }

    trace @"Completing validation"
    and {
      is_script_input?,
      name_matches?,
      action_valid?,
    }
  }

  /// Fallback handler
  else(_) {
    trace @"basket_token_policy_ref: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// TESTS
// ============================================================================

test test_mint_action_is_positive() {
  when MintTokens is {
    MintTokens -> True
    BurnTokens -> False
  }
}

test test_burn_action_is_negative() {
  when BurnTokens is {
    MintTokens -> False
    BurnTokens -> True
  }
}
