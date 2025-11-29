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
    // BTC: $60,000 -> 60_000_000_000
    ("BTC", 60_000 * price_precision),
    // ETH: $3,000 -> 3_000_000_000
    ("ETH", 3_000 * price_precision),
    // SOL: $150 -> 150_000_000
    ("SOL", 150 * price_precision),
    // ADA: $0.50 -> 500_000
    ("ADA", price_precision / 2),
    // LINK: $15 -> 15_000_000
    ("LINK", 15 * price_precision),
    // DOT: $7 -> 7_000_000
    ("DOT", 7 * price_precision),
    // Gold: $4,232.20 -> 4_232_200_000
    ("Gold", 4_232_200_000),
    // Silver: $56.63 -> 56_630_000
    ("Silver", 56_630_000),
    // AAPL: $277.50 -> 277_500_000
    ("AAPL", 277_500_000),
    // MSFT: $491.74 -> 491_740_000
    ("MSFT", 491_740_000),
    // GOOGL: $320.57 -> 320_570_000
    ("GOOGL", 320_570_000),
    // AMZN: $230.05 -> 230_050_000
    ("AMZN", 230_050_000),
    // NVDA: $181.34 -> 181_340_000
    ("NVDA", 181_340_000),
    // META: $647.35 -> 647_350_000
    ("META", 647_350_000),
    // TSLA: $426.57 -> 426_570_000
    ("TSLA", 426_570_000),
  ]
}

/// Alternative prices for liquidation testing (prices increased)
pub fn liquidation_prices() -> List<(AssetId, Int)> {
  [
    // BTC: $90,000 (50% increase) -> 90_000_000_000
    ("BTC", 90_000 * price_precision),
    // ETH: $4,500 (50% increase) -> 4_500_000_000
    ("ETH", 4_500 * price_precision),
    // SOL: $225 (50% increase) -> 225_000_000
    ("SOL", 225 * price_precision),
    // ADA: $0.50 (unchanged) -> 500_000
    ("ADA", price_precision / 2),
    // LINK: $22.50 (50% increase) -> 22_500_000
    ("LINK", 22_500_000),
    // DOT: $10.50 (50% increase) -> 10_500_000
    ("DOT", 10_500_000),
    // Gold: $6,348 (50% increase) -> 6_348_000_000
    ("Gold", 6_348_000_000),
    // Silver: $84.945 (50% increase) -> 84_945_000
    ("Silver", 84_945_000),
    // AAPL: $416.25 (50% increase) -> 416_250_000
    ("AAPL", 416_250_000),
    // MSFT: $737.61 (50% increase) -> 737_610_000
    ("MSFT", 737_610_000),
    // GOOGL: $480.855 (50% increase) -> 480_855_000
    ("GOOGL", 480_855_000),
    // AMZN: $345.075 (50% increase) -> 345_075_000
    ("AMZN", 345_075_000),
    // NVDA: $272.01 (50% increase) -> 272_010_000
    ("NVDA", 272_010_000),
    // META: $971.025 (50% increase) -> 971_025_000
    ("META", 971_025_000),
    // TSLA: $639.855 (50% increase) -> 639_855_000
    ("TSLA", 639_855_000),
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

test test_default_prices_btc() {
  let prices = default_prices()
  expect Some((_, btc_price)) = list.find(prices, fn((id, _)) { id == "BTC" })
  btc_price == 60_000_000_000
}

test test_default_prices_ada() {
  let prices = default_prices()
  expect Some((_, ada_price)) = list.find(prices, fn((id, _)) { id == "ADA" })
  ada_price == 500_000
}

test test_liquidation_prices_higher() {
  let default = default_prices()
  let liquidation = liquidation_prices()
  expect Some((_, default_btc)) =
    list.find(default, fn((id, _)) { id == "BTC" })
  expect Some((_, liq_btc)) =
    list.find(liquidation, fn((id, _)) { id == "BTC" })
  liq_btc > default_btc
}
