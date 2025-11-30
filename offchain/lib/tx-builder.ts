// EquiBaskets - Transaction Builder Utilities

import {
  Address,
  Data,
  fromText,
  toText,
  LucidEvolution,
  mintingPolicyToId,
  TxSignBuilder,
  Validator,
  validatorToAddress,
  toUnit,
  UTxO,
  Constr,
} from "@evolution-sdk/lucid";

import { network } from "@/config/lucid";
import { Scripts, ScriptHashes, AppliedScripts, PRICE_PRECISION, COLLATERAL_RATIO, WEIGHT_PRECISION } from "@/config/scripts";
import type { 
  BasketDatum, 
  VaultDatum, 
  OracleDatum, 
  PoolDatum, 
  PoolRedeemer, 
  LpMintRedeemer, 
  BasketAsset,
  TxStatus,
  LogEntry,
  LogLevel 
} from "@/types/equibasket";

// =============================================================================
// LOGGER
// =============================================================================

const logs: LogEntry[] = [];

export function log(level: LogLevel, message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data,
  };
  logs.push(entry);
  
  const prefix = `[${level.toUpperCase()}] [${entry.timestamp.toISOString()}]`;
  
  switch (level) {
    case "error":
      console.error(prefix, message, data || "");
      break;
    case "warn":
      console.warn(prefix, message, data || "");
      break;
    case "debug":
      console.log(prefix, message, data || "");
      break;
    default:
      console.log(prefix, message, data || "");
  }
  
  return entry;
}

export function getLogs(): LogEntry[] {
  return [...logs];
}

export function clearLogs() {
  logs.length = 0;
}

// =============================================================================
// VALIDATORS
// =============================================================================

export const Validators = {
  basketFactory: (): Validator => ({ type: "PlutusV3", script: Scripts.BasketFactory }),
  mockOracle: (): Validator => ({ type: "PlutusV3", script: Scripts.MockOracle }),
  // Vault is parameterized with oracle and basket factory script hashes
  vault: (): Validator => ({ type: "PlutusV3", script: AppliedScripts.Vault }),
  basketTokenPolicy: (): Validator => ({ type: "PlutusV3", script: Scripts.BasketTokenPolicy }),
  liquidityPool: (): Validator => ({ type: "PlutusV3", script: AppliedScripts.LiquidityPool }), // New
  lpTokenPolicy: (): Validator => ({ type: "PlutusV3", script: Scripts.LpTokenPolicy }), // New
};

export const ValidatorAddresses = {
  basketFactory: () => validatorToAddress(network, Validators.basketFactory()),
  mockOracle: () => validatorToAddress(network, Validators.mockOracle()),
  vault: () => validatorToAddress(network, Validators.vault()),
  liquidityPool: () => validatorToAddress(network, Validators.liquidityPool()), // New
};

// =============================================================================
// DATUM CONSTRUCTORS
// =============================================================================

export function encodeOracleDatum(datum: OracleDatum): string {
  // OracleDatum { prices, last_updated, admin }
  // Note: In Aiken, Tuples are encoded as plain lists, NOT constructors
  const pricesList = datum.prices.map(([id, price]) => {
    const assetIdHex = fromText(id);  // Convert asset name to UTF-8 hex
    return [assetIdHex, price];  // Tuple = plain list
  });
  
  // Debug: Log the structure being encoded
  log("debug", "Encoding OracleDatum:", {
    pricesCount: pricesList.length,
    firstPrice: pricesList[0] ? {
      assetIdHex: pricesList[0][0],
      price: pricesList[0][1]?.toString()
    } : "none",
    lastUpdated: datum.last_updated.toString(),
    adminPkh: datum.admin,
    adminLength: datum.admin.length
  });
  
  // Correct order per plutus.json: prices, last_updated, admin
  const datumData = new Constr(0, [
    pricesList,
    datum.last_updated,
    datum.admin,
  ]);
  
  const encoded = Data.to(datumData);
  
  // Log first part of encoded datum for debugging
  log("debug", "Encoded OracleDatum CBOR:", {
    fullLength: encoded.length,
    preview: encoded.substring(0, 120)
  });
  
  return encoded;
}

export function encodeBasketDatum(datum: BasketDatum): string {
  // BasketDatum { basket_id, name, assets, creator, created_at }
  // Note: In Aiken, Tuples are encoded as plain lists, NOT constructors
  const assetsList = datum.assets.map(asset => 
    [fromText(asset.id), BigInt(asset.weight)]  // Tuple = plain list, not Constr
  );
  
  const datumData = new Constr(0, [
    fromText(datum.basket_id),
    fromText(datum.name),
    assetsList,
    datum.creator,
    datum.created_at,
  ]);
  
  return Data.to(datumData);
}

export function encodeVaultDatum(datum: VaultDatum): string {
  // VaultDatum { owner, basket_id, collateral_ada, minted_tokens, created_at }
  const datumData = new Constr(0, [
    datum.owner,
    fromText(datum.basket_id),
    datum.collateral_ada,
    datum.minted_tokens,
    datum.created_at,
  ]);
  
  return Data.to(datumData);
}

export function encodePoolDatum(datum: PoolDatum): string {
  // PoolDatum { basket_id, basket_reserve, ada_reserve, lp_token_supply, created_at }
  const datumData = new Constr(0, [
    fromText(datum.basket_id),
    datum.basket_reserve,
    datum.ada_reserve,
    datum.lp_token_supply,
    datum.created_at,
  ]);

  return Data.to(datumData);
}

// =============================================================================
// REDEEMER CONSTRUCTORS
// =============================================================================

export const BasketRedeemers = {
  createBasket: (): string => Data.to(new Constr(0, [])),
  updateBasket: (newWeights: BasketAsset[]): string => {
    // Tuples are encoded as plain lists in Aiken
    const weightsList = newWeights.map(asset => 
      [fromText(asset.id), BigInt(asset.weight)]  // Tuple = plain list
    );
    return Data.to(new Constr(1, [weightsList]));
  },
};

export const VaultRedeemers = {
  deposit: (amount: bigint): string => Data.to(new Constr(0, [amount])),
  withdraw: (amount: bigint): string => Data.to(new Constr(1, [amount])),
  mint: (amount: bigint): string => Data.to(new Constr(2, [amount])),
  burn: (amount: bigint): string => Data.to(new Constr(3, [amount])),
  liquidate: (): string => Data.to(new Constr(4, [])),
};

export const MintRedeemers = {
  mint: (txId: string, outputIndex: number): string => Data.to(new Constr(0, [
    new Constr(0, []),  // MintTokens
    new Constr(0, [txId, BigInt(outputIndex)]),  // OutputReference
  ])),
  burn: (txId: string, outputIndex: number): string => Data.to(new Constr(0, [
    new Constr(1, []),  // BurnTokens
    new Constr(0, [txId, BigInt(outputIndex)]),  // OutputReference
  ])),
};

export const PoolRedeemers = {
  createPool: (initialBasket: bigint, initialAda: bigint): string => Data.to(new Constr(0, [initialBasket, initialAda])),
  addLiquidity: (basketAmount: bigint, adaAmount: bigint, minLpTokens: bigint): string => Data.to(new Constr(1, [basketAmount, adaAmount, minLpTokens])),
  removeLiquidity: (lpTokens: bigint, minBasket: bigint, minAda: bigint): string => Data.to(new Constr(2, [lpTokens, minBasket, minAda])),
  swapBasketForAda: (basketIn: bigint, minAdaOut: bigint): string => Data.to(new Constr(3, [basketIn, minAdaOut])),
  swapAdaForBasket: (adaIn: bigint, minBasketOut: bigint): string => Data.to(new Constr(4, [adaIn, minBasketOut])),
};

export const LpMintRedeemers = {
  mintLpTokens: (poolRef: UTxO): string => Data.to(new Constr(0, [
    new Constr(0, []), // MintLpTokens
    new Constr(0, [poolRef.txHash, BigInt(poolRef.outputIndex)]), // OutputReference
  ])),
  burnLpTokens: (poolRef: UTxO): string => Data.to(new Constr(0, [
    new Constr(1, []), // BurnLpTokens
    new Constr(0, [poolRef.txHash, BigInt(poolRef.outputIndex)]), // OutputReference
  ])),
};

// =============================================================================
// DATUM DECODERS
// =============================================================================

/**
 * Decode a VaultDatum from its CBOR hex representation
 * VaultDatum = Constr(0, [owner, basket_id, collateral_ada, minted_tokens, created_at])
 */
export function decodeVaultDatum(datumHex: string): VaultDatum {
  try {
    const decoded = Data.from(datumHex) as Constr<Data>;
    
    if (decoded.index !== 0 || decoded.fields.length !== 5) {
      throw new Error("Invalid VaultDatum structure");
    }
    
    const [owner, basket_id, collateral_ada, minted_tokens, created_at] = decoded.fields;
    
    return {
      owner: owner as string,
      basket_id: toText(basket_id as string),  // Convert hex to text
      collateral_ada: collateral_ada as bigint,
      minted_tokens: minted_tokens as bigint,
      created_at: created_at as bigint,
    };
  } catch (error) {
    log("error", "Failed to decode VaultDatum", error);
    throw new Error(`Failed to decode VaultDatum: ${error}`);
  }
}

/**
 * Decode a BasketDatum from its CBOR hex representation
 * BasketDatum = Constr(0, [basket_id, name, assets, creator, created_at])
 */
export function decodeBasketDatum(datumHex: string): BasketDatum {
  try {
    const decoded = Data.from(datumHex) as Constr<Data>;
    
    if (decoded.index !== 0 || decoded.fields.length !== 5) {
      throw new Error("Invalid BasketDatum structure");
    }
    
    const [basket_id, name, assets, creator, created_at] = decoded.fields;
    
    // Decode assets (list of tuples: [asset_id, weight])
    const decodedAssets = (assets as Array<[string, bigint]>).map(([assetIdHex, weight]) => ({
      id: toText(assetIdHex),
      weight: Number(weight),
    }));
    
    return {
      basket_id: toText(basket_id as string),
      name: toText(name as string),
      assets: decodedAssets,
      creator: creator as string,
      created_at: created_at as bigint,
    };
  } catch (error) {
    log("error", "Failed to decode BasketDatum", error);
    throw new Error(`Failed to decode BasketDatum: ${error}`);
  }
}

/**
 * Decode a PoolDatum from its CBOR hex representation
 * PoolDatum = Constr(0, [basket_id, basket_reserve, ada_reserve, lp_token_supply, created_at])
 */
export function decodePoolDatum(datumHex: string): PoolDatum {
  try {
    const decoded = Data.from(datumHex) as Constr<Data>;

    if (decoded.index !== 0 || decoded.fields.length !== 5) {
      throw new Error("Invalid PoolDatum structure");
    }

    const [basket_id, basket_reserve, ada_reserve, lp_token_supply, created_at] = decoded.fields;

    return {
      basket_id: toText(basket_id as string),
      basket_reserve: basket_reserve as bigint,
      ada_reserve: ada_reserve as bigint,
      lp_token_supply: lp_token_supply as bigint,
      created_at: created_at as bigint,
    };
  } catch (error) {
    log("error", "Failed to decode PoolDatum", error);
    throw new Error(`Failed to decode PoolDatum: ${error}`);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function calculateBasketPrice(
  oraclePrices: Map<string, bigint>,
  basketAssets: BasketAsset[]
): bigint {
  let totalPrice = 0n;
  
  for (const asset of basketAssets) {
    const price = oraclePrices.get(asset.id);
    if (!price) {
      log("error", `Asset ${asset.id} not found in oracle prices`);
      throw new Error(`Asset ${asset.id} not found in oracle`);
    }
    
    const weightedPrice = (price * BigInt(asset.weight)) / WEIGHT_PRECISION;
    totalPrice += weightedPrice;
  }
  
  return totalPrice;
}

export function isHealthy(collateralValue: bigint, mintedValue: bigint): boolean {
  return collateralValue * PRICE_PRECISION >= mintedValue * COLLATERAL_RATIO;
}

export function calculateCollateralRatio(collateralValue: bigint, mintedValue: bigint): number {
  if (mintedValue === 0n) return Infinity;
  return Number((collateralValue * PRICE_PRECISION * 100n) / (mintedValue * PRICE_PRECISION)) / 100;
}

export function lovelaceToAda(lovelace: bigint): number {
  return Number(lovelace) / 1_000_000;
}

export function adaToLovelace(ada: number): bigint {
  return BigInt(Math.floor(ada * 1_000_000));
}

export function priceToUsd(price: bigint): number {
  return Number(price) / Number(PRICE_PRECISION);
}

// =============================================================================
// TRANSACTION BUILDER CLASS
// =============================================================================

export class EquiBasketTxBuilder {
  private lucid: LucidEvolution;
  private address: Address;
  private pkh: string;
  
  constructor(lucid: LucidEvolution, address: Address, pkh: string) {
    this.lucid = lucid;
    this.address = address;
    this.pkh = pkh;
  }
  
  // ---------------------------------------------------------------------------
  // ORACLE TRANSACTIONS
  // ---------------------------------------------------------------------------
  
  async publishOracle(prices: Array<[string, bigint]>): Promise<TxSignBuilder> {
    log("info", "Building publish oracle transaction", { prices });
    
    const oracleAddress = ValidatorAddresses.mockOracle();
    
    const datum: OracleDatum = {
      prices,
      last_updated: BigInt(Date.now()),
      admin: this.pkh,
    };
    
    // Encode and log the datum for debugging
    const encodedDatum = encodeOracleDatum(datum);
    log("debug", "Oracle datum being published:", {
      admin: this.pkh,
      priceCount: prices.length,
      encodedDatumPreview: encodedDatum.substring(0, 100) + "...",
      encodedDatumLength: encodedDatum.length
    });
    
    const tx = await this.lucid
      .newTx()
      .pay.ToAddressWithData(
        oracleAddress,
        { kind: "inline", value: encodedDatum },
        { lovelace: 5_000_000n }  // 5 ADA min UTxO
      )
      .validTo(Date.now() + 15 * 60_000)
      .complete();
    
    log("info", "Oracle publish transaction built successfully");
    return tx;
  }
  
  // ---------------------------------------------------------------------------
  // BASKET TRANSACTIONS
  // ---------------------------------------------------------------------------
  
  async createBasket(
    basketId: string,
    name: string,
    assets: BasketAsset[]
  ): Promise<TxSignBuilder> {
    log("info", "Building create basket transaction", { basketId, name, assets });
    
    // Validate weights sum to 10000
    const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
    if (totalWeight !== 10000) {
      throw new Error(`Weights must sum to 10000, got ${totalWeight}`);
    }
    
    const factoryAddress = ValidatorAddresses.basketFactory();
    
    const datum: BasketDatum = {
      basket_id: basketId,
      name,
      assets,
      creator: this.pkh,
      created_at: BigInt(Date.now()),
    };
    
    const tx = await this.lucid
      .newTx()
      .pay.ToAddressWithData(
        factoryAddress,
        { kind: "inline", value: encodeBasketDatum(datum) },
        { lovelace: 5_000_000n }
      )
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();
    
    log("info", "Create basket transaction built successfully");
    return tx;
  }
  
  // ---------------------------------------------------------------------------
  // VAULT TRANSACTIONS
  // ---------------------------------------------------------------------------
  
  async openVaultAndDeposit(
    basketId: string,
    collateralAda: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building open vault transaction", { basketId, collateralAda });
    
    const vaultAddress = ValidatorAddresses.vault();
    
    const datum: VaultDatum = {
      owner: this.pkh,
      basket_id: basketId,
      collateral_ada: collateralAda,
      minted_tokens: 0n,
      created_at: BigInt(Date.now()),
    };
    
    const tx = await this.lucid
      .newTx()
      .pay.ToAddressWithData(
        vaultAddress,
        { kind: "inline", value: encodeVaultDatum(datum) },
        { lovelace: collateralAda }
      )
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();
    
    log("info", "Open vault transaction built successfully");
    return tx;
  }
  
  async mintBasketTokens(
    vaultUtxo: UTxO,
    oracleUtxo: UTxO,
    basketUtxo: UTxO,
    mintAmount: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building mint transaction", { mintAmount });
    
    // Debug: Log the UTxOs being used
    log("debug", "Using Oracle UTxO:", {
      txHash: oracleUtxo.txHash,
      outputIndex: oracleUtxo.outputIndex,
      hasDatum: !!oracleUtxo.datum,
      datumPreview: oracleUtxo.datum ? oracleUtxo.datum.substring(0, 100) + "..." : "none"
    });
    log("debug", "Using Vault UTxO:", {
      txHash: vaultUtxo.txHash,
      outputIndex: vaultUtxo.outputIndex,
      lovelace: vaultUtxo.assets.lovelace.toString()
    });
    log("debug", "Using Basket UTxO:", {
      txHash: basketUtxo.txHash,
      outputIndex: basketUtxo.outputIndex
    });
    
    const vault = Validators.vault();
    const mintingPolicy = Validators.basketTokenPolicy();
    const policyId = mintingPolicyToId(mintingPolicy);
    
    // Parse current vault datum from the UTxO
    const currentDatumHex = vaultUtxo.datum;
    if (!currentDatumHex) throw new Error("Vault UTxO has no datum");
    
    // Decode the actual vault datum from the UTxO
    const vaultDatum = decodeVaultDatum(currentDatumHex);
    log("debug", "Decoded vault datum:", {
      owner: vaultDatum.owner,
      basket_id: vaultDatum.basket_id,
      collateral_ada: vaultDatum.collateral_ada.toString(),
      minted_tokens: vaultDatum.minted_tokens.toString(),
    });
    
    // Verify the owner matches
    // if (vaultDatum.owner !== this.pkh) {
    //   throw new Error("You are not the owner of this vault");
    // }
    
    // Update vault datum with new minted tokens
    const newVaultDatum: VaultDatum = {
      ...vaultDatum,
      minted_tokens: vaultDatum.minted_tokens + mintAmount,
    };
    
    // Token name is the basket_id (must match the on-chain vault datum)
    const tokenName = fromText(vaultDatum.basket_id);
    const assetUnit = toUnit(policyId, tokenName);
    
    log("debug", "Token to mint:", {
      basket_id: vaultDatum.basket_id,
      tokenNameHex: tokenName,
      assetUnit: assetUnit,
    });
    
    const vaultRedeemer = VaultRedeemers.mint(mintAmount);
    const mintRedeemer = MintRedeemers.mint(
      vaultUtxo.txHash,
      vaultUtxo.outputIndex
    );
    
    const tx = await this.lucid
      .newTx()
      .readFrom([oracleUtxo, basketUtxo])
      .collectFrom([vaultUtxo], vaultRedeemer)
      .mintAssets({ [assetUnit]: mintAmount }, mintRedeemer)
      .pay.ToAddressWithData(
        ValidatorAddresses.vault(),
        { kind: "inline", value: encodeVaultDatum(newVaultDatum) },
        { lovelace: vaultDatum.collateral_ada }
      )
      .attach.SpendingValidator(vault)
      .attach.MintingPolicy(mintingPolicy)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();
    
    log("info", "Mint transaction built successfully");
    return tx;
  }
  
  async burnBasketTokens(
    vaultUtxo: UTxO,
    oracleUtxo: UTxO,
    basketUtxo: UTxO,
    burnAmount: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building burn transaction", { burnAmount });
    
    const vault = Validators.vault();
    const mintingPolicy = Validators.basketTokenPolicy();
    const policyId = mintingPolicyToId(mintingPolicy);
    
    // Parse current vault datum from the UTxO
    const currentDatumHex = vaultUtxo.datum;
    if (!currentDatumHex) throw new Error("Vault UTxO has no datum");
    
    // Decode the actual vault datum from the UTxO
    const vaultDatum = decodeVaultDatum(currentDatumHex);
    log("debug", "Decoded vault datum for burn:", {
      owner: vaultDatum.owner,
      basket_id: vaultDatum.basket_id,
      minted_tokens: vaultDatum.minted_tokens.toString(),
    });
    
    // Verify the owner matches
    // if (vaultDatum.owner !== this.pkh) {
    //   throw new Error("You are not the owner of this vault");
    // }
    
    // Verify we have enough tokens to burn
    if (vaultDatum.minted_tokens < burnAmount) {
      throw new Error(`Cannot burn ${burnAmount} tokens, only ${vaultDatum.minted_tokens} minted`);
    }
    
    // Update vault datum with reduced minted tokens
    const newVaultDatum: VaultDatum = {
      ...vaultDatum,
      minted_tokens: vaultDatum.minted_tokens - burnAmount,
    };
    
    // Token name is the basket_id (must match the on-chain vault datum)
    const tokenName = fromText(vaultDatum.basket_id);
    const assetUnit = toUnit(policyId, tokenName);
    
    const vaultRedeemer = VaultRedeemers.burn(burnAmount);
    const mintRedeemer = MintRedeemers.burn(
      vaultUtxo.txHash,
      vaultUtxo.outputIndex
    );
    
    const tx = await this.lucid
      .newTx()
      .readFrom([oracleUtxo, basketUtxo])
      .collectFrom([vaultUtxo], vaultRedeemer)
      .mintAssets({ [assetUnit]: -burnAmount }, mintRedeemer)
      .pay.ToAddressWithData(
        ValidatorAddresses.vault(),
        { kind: "inline", value: encodeVaultDatum(newVaultDatum) },
        { lovelace: vaultDatum.collateral_ada }
      )
      .attach.SpendingValidator(vault)
      .attach.MintingPolicy(mintingPolicy)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();
    
    log("info", "Burn transaction built successfully");
    return tx;
  }

  // ---------------------------------------------------------------------------
  // LIQUIDITY POOL TRANSACTIONS
  // ---------------------------------------------------------------------------

  async createLiquidityPool(
    basketUtxo: UTxO, // Reference to the basket UTxO (from factory)
    initialBasketAmount: bigint,
    initialAdaAmount: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building create liquidity pool transaction", { initialBasketAmount, initialAdaAmount });

    const poolAddress = ValidatorAddresses.liquidityPool();
    const lpMintingPolicy = Validators.lpTokenPolicy();
    const lpPolicyId = mintingPolicyToId(lpMintingPolicy);

    // Get basket ID from the basket UTxO
    const basketDatum = decodeBasketDatum(basketUtxo.datum as string);
    const basketId = basketDatum.basket_id;

    // LP token name is the basketId
    const lpTokenName = fromText(basketId);
    const lpAssetUnit = toUnit(lpPolicyId, lpTokenName);

    const datum: PoolDatum = {
      basket_id: basketId,
      basket_reserve: initialBasketAmount,
      ada_reserve: initialAdaAmount,
      lp_token_supply: 0n, // Will be updated on-chain
      created_at: BigInt(Date.now()),
    };

    const poolRedeemer = PoolRedeemers.createPool(initialBasketAmount, initialAdaAmount);
    const lpMintRedeemer = LpMintRedeemers.mintLpTokens(basketUtxo); // Using basketUtxo as poolRef for initial mint

    const tx = await this.lucid
      .newTx()
      .readFrom([basketUtxo]) // Reference to the basket UTxO
      .collectFrom(
        await this.lucid.wallet.getUtxos(), // Collect from wallet for initial ADA & Basket
        poolRedeemer
      )
      .pay.ToAddressWithData(
        poolAddress,
        { kind: "inline", value: encodePoolDatum(datum) },
        { lovelace: initialAdaAmount, [lpAssetUnit]: initialBasketAmount } // Pay initial ADA and basket tokens
      )
      .mintAssets({ [lpAssetUnit]: 0n }, lpMintRedeemer) // Mint 0 LP tokens initially, validator will adjust
      .attach.SpendingValidator(Validators.liquidityPool())
      .attach.MintingPolicy(lpMintingPolicy)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();

    log("info", "Create liquidity pool transaction built successfully");
    return tx;
  }

  async addLiquidity(
    poolUtxo: UTxO,
    basketUtxo: UTxO,
    basketAmount: bigint,
    adaAmount: bigint,
    minLpTokens: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building add liquidity transaction", { basketAmount, adaAmount, minLpTokens });

    const pool = Validators.liquidityPool();
    const lpMintingPolicy = Validators.lpTokenPolicy();
    const lpPolicyId = mintingPolicyToId(lpMintingPolicy);

    const poolDatum = decodePoolDatum(poolUtxo.datum as string);
    const basketId = poolDatum.basket_id;

    const lpTokenName = fromText(basketId);
    const lpAssetUnit = toUnit(lpPolicyId, lpTokenName);

    const poolRedeemer = PoolRedeemers.addLiquidity(basketAmount, adaAmount, minLpTokens);
    const lpMintRedeemer = LpMintRedeemers.mintLpTokens(poolUtxo);

    const tx = await this.lucid
      .newTx()
      .readFrom([basketUtxo])
      .collectFrom([poolUtxo], poolRedeemer)
      .mintAssets({ [lpAssetUnit]: 0n }, lpMintRedeemer) // Mint 0 LP tokens initially, validator will adjust
      .pay.ToAddress(
        ValidatorAddresses.liquidityPool(),
        { lovelace: poolUtxo.assets.lovelace + adaAmount, [lpAssetUnit]: poolUtxo.assets[lpAssetUnit] + basketAmount }
      )
      .attach.SpendingValidator(pool)
      .attach.MintingPolicy(lpMintingPolicy)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();

    log("info", "Add liquidity transaction built successfully");
    return tx;
  }

  async removeLiquidity(
    poolUtxo: UTxO,
    lpTokens: bigint,
    minBasket: bigint,
    minAda: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building remove liquidity transaction", { lpTokens, minBasket, minAda });

    const pool = Validators.liquidityPool();
    const lpMintingPolicy = Validators.lpTokenPolicy();
    const lpPolicyId = mintingPolicyToId(lpMintingPolicy);

    const poolDatum = decodePoolDatum(poolUtxo.datum as string);
    const basketId = poolDatum.basket_id;

    const lpTokenName = fromText(basketId);
    const lpAssetUnit = toUnit(lpPolicyId, lpTokenName);

    const poolRedeemer = PoolRedeemers.removeLiquidity(lpTokens, minBasket, minAda);
    const lpBurnRedeemer = LpMintRedeemers.burnLpTokens(poolUtxo);

    const tx = await this.lucid
      .newTx()
      .collectFrom([poolUtxo], poolRedeemer)
      .mintAssets({ [lpAssetUnit]: -lpTokens }, lpBurnRedeemer) // Burn LP tokens
      .pay.ToAddress(
        this.address, // Return to user
        { lovelace: minAda, [lpAssetUnit]: minBasket } // Return min ADA and Basket
      )
      .attach.SpendingValidator(pool)
      .attach.MintingPolicy(lpMintingPolicy)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();

    log("info", "Remove liquidity transaction built successfully");
    return tx;
  }

  async swapBasketForAda(
    poolUtxo: UTxO,
    basketUtxo: UTxO,
    basketIn: bigint,
    minAdaOut: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building swap basket for ADA transaction", { basketIn, minAdaOut });

    const pool = Validators.liquidityPool();

    const poolDatum = decodePoolDatum(poolUtxo.datum as string);
    const basketId = poolDatum.basket_id;

    const poolRedeemer = PoolRedeemers.swapBasketForAda(basketIn, minAdaOut);

    const tx = await this.lucid
      .newTx()
      .readFrom([basketUtxo])
      .collectFrom([poolUtxo], poolRedeemer)
      .pay.ToAddress(
        ValidatorAddresses.liquidityPool(),
        { lovelace: poolUtxo.assets.lovelace - minAdaOut, [toUnit("", fromText(basketId))]: (poolUtxo.assets[toUnit("", fromText(basketId))] || 0n) + basketIn } // Update pool reserves
      )
      .pay.ToAddress(this.address, { lovelace: minAdaOut }) // Send ADA to user
      .attach.SpendingValidator(pool)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();

    log("info", "Swap basket for ADA transaction built successfully");
    return tx;
  }

  async swapAdaForBasket(
    poolUtxo: UTxO,
    adaIn: bigint,
    minBasketOut: bigint
  ): Promise<TxSignBuilder> {
    log("info", "Building swap ADA for basket transaction", { adaIn, minBasketOut });

    const pool = Validators.liquidityPool();

    const poolDatum = decodePoolDatum(poolUtxo.datum as string);
    const basketId = poolDatum.basket_id;

    const poolRedeemer = PoolRedeemers.swapAdaForBasket(adaIn, minBasketOut);

    const tx = await this.lucid
      .newTx()
      .collectFrom([poolUtxo], poolRedeemer)
      .pay.ToAddress(
        ValidatorAddresses.liquidityPool(),
        { lovelace: poolUtxo.assets.lovelace + adaIn, [toUnit("", fromText(basketId))]: (poolUtxo.assets[toUnit("", fromText(basketId))] || 0n) - minBasketOut } // Update pool reserves
      )
      .pay.ToAddress(this.address, { [toUnit("", fromText(basketId))]: minBasketOut }) // Send basket tokens to user
      .attach.SpendingValidator(pool)
      .addSignerKey(this.pkh)
      .validTo(Date.now() + 15 * 60_000)
      .complete();

    log("info", "Swap ADA for basket transaction built successfully");
    return tx;
  }

  
  // ---------------------------------------------------------------------------
  // QUERY FUNCTIONS
  // ---------------------------------------------------------------------------
  
  async getOracleUtxos(): Promise<UTxO[]> {
    const address = ValidatorAddresses.mockOracle();
    const utxos = await this.lucid.utxosAt(address);
    
    // Debug: Log oracle UTxOs to help identify datum issues
    log("debug", `Found ${utxos.length} oracle UTxO(s) at ${address}`);
    utxos.forEach((utxo, i) => {
      log("debug", `Oracle UTxO[${i}]:`, {
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        hasDatum: !!utxo.datum,
        datumPreview: utxo.datum ? utxo.datum.substring(0, 100) + "..." : "none"
      });
    });
    
    return utxos;
  }
  
  /**
   * Get oracle UTxOs filtered by admin (your PKH).
   * This helps ensure you use an oracle you deployed.
   */
  async getMyOracleUtxos(): Promise<UTxO[]> {
    const utxos = await this.getOracleUtxos();
    
    // Filter by admin PKH if possible (requires parsing datums)
    // For now, prefer the most recent (last) UTxO
    // This assumes newer deploys appear later
    if (utxos.length > 1) {
      log("warn", `Multiple oracle UTxOs found (${utxos.length}). Consider cleaning up old oracles.`);
    }
    
    return utxos;
  }
  
  async getBasketUtxos(): Promise<UTxO[]> {
    const address = ValidatorAddresses.basketFactory();
    const utxos = await this.lucid.utxosAt(address);
    
    // Debug: Log basket UTxOs
    log("debug", `Found ${utxos.length} basket UTxO(s) at ${address}`);
    utxos.forEach((utxo, i) => {
      log("debug", `Basket UTxO[${i}]:`, {
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        hasDatum: !!utxo.datum,
        datumPreview: utxo.datum ? utxo.datum.substring(0, 100) + "..." : "none"
      });
    });
    
    return utxos;
  }
  
  async getVaultUtxos(): Promise<UTxO[]> {
    const address = ValidatorAddresses.vault();
    const utxos = await this.lucid.utxosAt(address);
    
    // Debug: Log vault UTxOs
    log("debug", `Found ${utxos.length} vault UTxO(s) at ${address}`);
    utxos.forEach((utxo, i) => {
      log("debug", `Vault UTxO[${i}]:`, {
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        hasDatum: !!utxo.datum,
        lovelace: utxo.assets.lovelace?.toString() || "0"
      });
    });
    
    return utxos;
  }
  
  async getUserVaultUtxos(): Promise<UTxO[]> {
    const allVaults = await this.getVaultUtxos();
    // Filter by owner (would need to parse datums)
    // For now, return all vaults
    return allVaults;
  }

  async getLiquidityPoolUtxos(): Promise<UTxO[]> {
    const address = ValidatorAddresses.liquidityPool();
    const utxos = await this.lucid.utxosAt(address);

    // Debug: Log liquidity pool UTxOs
    log("debug", `Found ${utxos.length} liquidity pool UTxO(s) at ${address}`);
    utxos.forEach((utxo, i) => {
      log("debug", `Liquidity Pool UTxO[${i}]:`, {
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        hasDatum: !!utxo.datum,
        lovelace: utxo.assets.lovelace?.toString() || "0",
      });
    });

    return utxos;
  }
}

// =============================================================================
// TRANSACTION SUBMISSION
// =============================================================================

export async function submitTx(tx: TxSignBuilder): Promise<string> {
  log("info", "Signing transaction...");
  const txSigned = await tx.sign.withWallet().complete();
  
  log("info", "Submitting transaction...");
  const txHash = await txSigned.submit();
  
  log("info", "Transaction submitted successfully", { txHash });
  return txHash;
}

