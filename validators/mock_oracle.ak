//// EquiBaskets - Mock Oracle Validator
////
//// This validator manages a UTxO containing hardcoded asset prices.
//// Only the admin can update prices, but anyone can reference the UTxO.

use aiken/collection/list
use cardano/address.{Script}
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction}
use types.{
  AssetId, OracleDatum, OracleRedeemer, ReadPrice, UpdatePrices, price_precision,
}

// ============================================================================
// VALIDATOR
// ============================================================================

validator mock_oracle {
  /// Spend validator: controls how oracle UTxO can be spent
  spend(
    datum: Option<OracleDatum>,
    redeemer: OracleRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    trace @"mock_oracle.spend: Starting validation"
    // Extract datum
    expect Some(oracle_datum) = datum
    trace @"Oracle datum extracted successfully"

    when redeemer is {
      UpdatePrices { new_prices } -> {
        trace @"UpdatePrices: Validating price update operation"
        // Only admin can update prices
        let admin_signed = list.has(tx.extra_signatories, oracle_datum.admin)
        trace @"Admin signature verification completed"
        // Validate new prices are all positive
        let prices_valid = validate_prices(new_prices)
        trace @"Price validation completed"
        // Find continuing output (oracle must persist)
        let continuing_output = find_continuing_output(tx.outputs, own_ref, tx)
        trace @"Continuing output found"
        // Verify continuing output has updated datum
        let output_valid =
          validate_continuing_output(
            continuing_output,
            oracle_datum.admin,
            new_prices,
          )
        trace @"Continuing output validated"
        and {
          admin_signed?,
          prices_valid?,
          output_valid?,
        }
      }

      ReadPrice -> {
        trace @"ReadPrice: Rejecting consumption attempt"
        // ReadPrice should not consume the UTxO - always fail
        // Use reference inputs instead
        fail @"Use reference inputs to read oracle prices"
      }
    }
  }

  /// Fallback handler for other script purposes
  else(_) {
    trace @"mock_oracle: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Validate all prices are positive
fn validate_prices(prices: List<(AssetId, Int)>) -> Bool {
  when prices is {
    [] -> True
    [(_, price), ..rest] ->
      if price > 0 {
        validate_prices(rest)
      } else {
        False
      }
  }
}

/// Find the continuing output to this validator
fn find_continuing_output(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
) -> Output {
  // Get own script hash from the input being spent
  expect Some(own_input) =
    list.find(tx.inputs, fn(input) { input.output_reference == own_ref })
  expect Script(own_hash) = own_input.output.address.payment_credential

  // Find output going back to same script
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

/// Validate the continuing output has correct datum
fn validate_continuing_output(
  output: Output,
  expected_admin: ByteArray,
  expected_prices: List<(AssetId, Int)>,
) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: OracleDatum = data
      and {
        // Admin must remain unchanged
        (new_datum.admin == expected_admin)?,
        // Prices must match expected
        (new_datum.prices == expected_prices)?,
        // last_updated should be updated (we don't enforce specific value)
        True,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

// ============================================================================
// HARDCODED PRICES FOR TESTING
// ============================================================================

/// Get default hardcoded prices for testing
/// Prices in 1e6 precision (multiply USD by 1_000_000)
pub fn default_prices() -> List<(AssetId, Int)> {
  [
    // Gold: $2,650.00 per troy ounce -> 2_650_000_000
    ("Gold", 2_650 * price_precision),
    // Silver: $30.50 per troy ounce -> 30_500_000
    ("Silver", 30_500_000),
    // AAPL (Apple): $240.00 -> 240_000_000
    ("AAPL", 240 * price_precision),
    // NVDA (Nvidia): $145.00 -> 145_000_000
    ("NVDA", 145 * price_precision),
    // Hitachi: $23.50 -> 23_500_000
    ("Hitachi", 23_500_000),
  ]
}

/// Alternative prices for liquidation testing (prices increased)
pub fn liquidation_prices() -> List<(AssetId, Int)> {
  [
    // Gold: $3,975 (50% increase) -> 3_975_000_000
    ("Gold", 3_975 * price_precision),
    // Silver: $45.75 (50% increase) -> 45_750_000
    ("Silver", 45_750_000),
    // AAPL (Apple): $360.00 (50% increase) -> 360_000_000
    ("AAPL", 360 * price_precision),
    // NVDA (Nvidia): $217.50 (50% increase) -> 217_500_000
    ("NVDA", 217_500_000),
    // Hitachi: $35.25 (50% increase) -> 35_250_000
    ("Hitachi", 35_250_000),
  ]
}

// ============================================================================
// TESTS
// ============================================================================

test test_validate_prices_valid() {
  let prices = [("BTC", 60_000_000_000), ("ETH", 3_000_000_000)]
  validate_prices(prices)
}

test test_validate_prices_invalid_zero() {
  let prices = [("BTC", 60_000_000_000), ("ETH", 0)]
  !validate_prices(prices)
}

test test_validate_prices_invalid_negative() {
  let prices = [("BTC", -100), ("ETH", 3_000_000_000)]
  !validate_prices(prices)
}

test test_validate_prices_empty() {
  validate_prices([])
}

test test_default_prices_gold() {
  let prices = default_prices()
  expect Some((_, gold_price)) = list.find(prices, fn((id, _)) { id == "Gold" })
  gold_price == 2_650_000_000
}

test test_default_prices_hitachi() {
  let prices = default_prices()
  expect Some((_, hitachi_price)) =
    list.find(prices, fn((id, _)) { id == "Hitachi" })
  hitachi_price == 23_500_000
}

test test_liquidation_prices_higher() {
  let default = default_prices()
  let liquidation = liquidation_prices()
  expect Some((_, default_gold)) =
    list.find(default, fn((id, _)) { id == "Gold" })
  expect Some((_, liq_gold)) =
    list.find(liquidation, fn((id, _)) { id == "Gold" })
  liq_gold > default_gold
}
