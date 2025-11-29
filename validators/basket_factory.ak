//// EquiBaskets - Basket Factory Validator
////
//// This validator manages basket definitions. Fund creators can register
//// new baskets with specific asset weights.

use aiken/collection/list
use cardano/address.{Script}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use types.{
  AssetId, BasketDatum, BasketRedeemer, CreateBasket, UpdateBasket, sum_weights,
  weight_precision,
}

// ============================================================================
// VALIDATOR
// ============================================================================

validator basket_factory {
  /// Spend validator: controls basket creation and updates
  spend(
    datum: Option<BasketDatum>,
    redeemer: BasketRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    trace @"basket_factory.spend: Starting validation"
    // Extract datum
    expect Some(basket_datum) = datum
    trace @"Basket datum extracted successfully"

    when redeemer is {
      CreateBasket -> {
        trace @"CreateBasket: Validating new basket creation"
        // For creation, we're consuming a "seed" UTxO and creating basket UTxOs
        // This is typically done by consuming an empty/initialization UTxO
        // Verify basket weights are valid (sum to 100%)
        let weights_valid = sum_weights(basket_datum.assets) == weight_precision
        trace @"Weight validation completed"
        // Verify basket has assets
        let has_assets = list.length(basket_datum.assets) > 0
        trace @"Asset count validation completed"
        // Verify basket_id is not empty
        let has_id = basket_datum.basket_id != ""
        trace @"Basket ID validation completed"
        // Verify creator signed the transaction
        let creator_signed =
          list.has(tx.extra_signatories, basket_datum.creator)
        trace @"Creator signature validation completed"
        and {
          weights_valid?,
          has_assets?,
          has_id?,
          creator_signed?,
        }
      }

      UpdateBasket { new_weights } -> {
        trace @"UpdateBasket: Validating basket weight update"
        // Only creator can update
        let creator_signed =
          list.has(tx.extra_signatories, basket_datum.creator)
        trace @"Creator signature checked"
        // New weights must be valid
        let weights_valid = sum_weights(new_weights) == weight_precision
        trace @"New weights validated"
        // Find continuing output
        let continuing_output = find_continuing_output(tx.outputs, own_ref, tx)
        trace @"Continuing output found"
        // Validate continuing output
        let output_valid =
          validate_basket_update(continuing_output, basket_datum, new_weights)
        trace @"Continuing output validated"
        and {
          creator_signed?,
          weights_valid?,
          output_valid?,
        }
      }
    }
  }

  /// Fallback handler
  else(_) {
    trace @"basket_factory: Unsupported script purpose"
    fail @"Unsupported script purpose"
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Find continuing output to this validator
fn find_continuing_output(
  outputs: List<Output>,
  own_ref: OutputReference,
  tx: Transaction,
) -> Output {
  // Get own script hash
  expect Some(own_input) =
    list.find(tx.inputs, fn(input) { input.output_reference == own_ref })
  expect Script(own_hash) = own_input.output.address.payment_credential

  // Find output to same script
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

/// Validate basket update maintains invariants
fn validate_basket_update(
  output: Output,
  original: BasketDatum,
  new_weights: List<(AssetId, Int)>,
) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect new_datum: BasketDatum = data
      and {
        // Basket ID must not change
        (new_datum.basket_id == original.basket_id)?,
        // Name must not change
        (new_datum.name == original.name)?,
        // Creator must not change
        (new_datum.creator == original.creator)?,
        // Created_at must not change
        (new_datum.created_at == original.created_at)?,
        // Assets must be updated to new weights
        (new_datum.assets == new_weights)?,
      }
    }
    _ -> fail @"Continuing output must have inline datum"
  }
}

/// Check if a basket with given ID exists in reference inputs
pub fn basket_exists(ref_inputs: List<Input>, basket_id: ByteArray) -> Bool {
  list.any(
    ref_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: BasketDatum = data
          datum.basket_id == basket_id
        }
        _ -> False
      }
    },
  )
}

/// Get basket datum from reference inputs
pub fn get_basket(ref_inputs: List<Input>, basket_id: ByteArray) -> BasketDatum {
  expect Some(input) =
    list.find(
      ref_inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: BasketDatum = data
            datum.basket_id == basket_id
          }
          _ -> False
        }
      },
    )
  expect InlineDatum(data) = input.output.datum
  expect datum: BasketDatum = data
  datum
}

// ============================================================================
// SAMPLE BASKETS FOR TESTING
// ============================================================================

/// Create a sample tech basket (BTC + ETH + SOL)
pub fn sample_tech_basket(creator: ByteArray, timestamp: Int) -> BasketDatum {
  BasketDatum {
    basket_id: "TECH_BASKET_001",
    name: "Tech Leaders Basket",
    assets: [("BTC", 5000), ("ETH", 3000), ("SOL", 2000)],
    creator,
    created_at: timestamp,
  }
}

/// Create a sample defi basket
pub fn sample_defi_basket(creator: ByteArray, timestamp: Int) -> BasketDatum {
  BasketDatum {
    basket_id: "DEFI_BASKET_001",
    name: "DeFi Leaders Basket",
    assets: [("ETH", 4000), ("LINK", 3000), ("DOT", 3000)],
    creator,
    created_at: timestamp,
  }
}

/// Create a sample balanced basket
pub fn sample_balanced_basket(creator: ByteArray, timestamp: Int) -> BasketDatum {
  BasketDatum {
    basket_id: "BALANCED_001",
    name: "Balanced Crypto Basket",
    assets: [("BTC", 3334), ("ETH", 3333), ("SOL", 3333)],
    creator,
    created_at: timestamp,
  }
}

// ============================================================================
// TESTS
// ============================================================================

test test_tech_basket_weights() {
  let basket = sample_tech_basket("admin", 1000)
  sum_weights(basket.assets) == weight_precision
}

test test_defi_basket_weights() {
  let basket = sample_defi_basket("admin", 1000)
  sum_weights(basket.assets) == weight_precision
}

test test_balanced_basket_weights() {
  let basket = sample_balanced_basket("admin", 1000)
  sum_weights(basket.assets) == weight_precision
}

test test_basket_has_id() {
  let basket = sample_tech_basket("admin", 1000)
  basket.basket_id != ""
}

test test_basket_has_assets() {
  let basket = sample_tech_basket("admin", 1000)
  list.length(basket.assets) > 0
}

test test_invalid_weights_over() {
  let assets = [("BTC", 6000), ("ETH", 5000)]
  sum_weights(assets) != weight_precision
}

test test_invalid_weights_under() {
  let assets = [("BTC", 3000), ("ETH", 2000)]
  sum_weights(assets) != weight_precision
}
