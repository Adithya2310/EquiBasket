// Mint & Burn Page

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/components/connection/context";
import { useDatabase } from "@/components/database/DatabaseProvider";
import { Button, Card, CardTitle, Select, Input } from "@/components/ui";
import { Tabs, TabsList, Tab, TabPanel } from "@/components/ui";
import { TransactionStatus } from "@/components/shared/TransactionStatus";
import { CollateralRatioBar } from "@/components/shared/CollateralRatioBar";
import { EquiBasketTxBuilder, submitTx, log, lovelaceToAda, adaToLovelace, decodeBasketDatum, decodeVaultDatum } from "@/lib/tx-builder";
import { tokenToUnits, TOKEN_DECIMALS } from "@/config/scripts";
import type { TxStatus } from "@/types/equibasket";

export function MintBurnPage() {
  const searchParams = useSearchParams();
  const [connection] = useWallet();
  const {
    baskets,
    oraclePrices,
    userVaults,
    isLoading,
    refreshVaults,
    addVault,
    updateVaultPosition
  } = useDatabase();

  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  // Selected basket
  const [selectedBasketId, setSelectedBasketId] = useState<string>("");

  // Form inputs
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  // Oracle status
  const [oracleDeployed, setOracleDeployed] = useState<boolean | null>(null);
  const [checkingOracle, setCheckingOracle] = useState(false);

  // Set initial basket from URL or first available
  useEffect(() => {
    const urlBasket = searchParams.get("basket");
    if (urlBasket && baskets.some((b) => b.basketId === urlBasket)) {
      setSelectedBasketId(urlBasket);
    } else if (baskets.length > 0 && !selectedBasketId) {
      setSelectedBasketId(baskets[0].basketId);
    }
  }, [searchParams, baskets, selectedBasketId]);

  // Refresh vaults when connection changes
  useEffect(() => {
    if (connection) {
      refreshVaults(connection.address);
    }
  }, [connection, refreshVaults]);

  // Check if oracle is deployed
  useEffect(() => {
    async function checkOracle() {
      if (!connection) return;

      try {
        setCheckingOracle(true);
        const txBuilder = new EquiBasketTxBuilder(
          connection.lucid,
          connection.address,
          connection.pkh
        );
        const oracleUtxos = await txBuilder.getOracleUtxos();
        setOracleDeployed(oracleUtxos.length > 0);
        log("info", "Oracle check completed", { deployed: oracleUtxos.length > 0 });
      } catch (error) {
        log("error", "Failed to check oracle", error);
        setOracleDeployed(false);
      } finally {
        setCheckingOracle(false);
      }
    }

    checkOracle();
  }, [connection]);

  // Deploy oracle function
  const handleDeployOracle = useCallback(async () => {
    if (!connection) return;

    try {
      setTxStatus({ status: "building", message: "Building oracle deployment transaction..." });
      log("info", "Deploying oracle with default prices");

      const txBuilder = new EquiBasketTxBuilder(
        connection.lucid,
        connection.address,
        connection.pkh
      );

      // Default prices from our oracle data
      const PRICE_PRECISION = 1_000_000n;
      const defaultPrices: Array<[string, bigint]> = [
        ["BTC", 60_000n * PRICE_PRECISION],
        ["ETH", 3_000n * PRICE_PRECISION],
        ["SOL", 150n * PRICE_PRECISION],
        ["ADA", 500_000n],  // 0.5 USD in micro-units
        ["LINK", 15n * PRICE_PRECISION],
        ["DOT", 7n * PRICE_PRECISION],
      ];

      const tx = await txBuilder.publishOracle(defaultPrices);

      setTxStatus({ status: "signing", message: "Waiting for wallet signature..." });
      const txHash = await submitTx(tx);

      setTxStatus({
        status: "success",
        txHash,
        message: "Oracle deployed successfully! You can now mint tokens.",
      });

      setOracleDeployed(true);
    } catch (error: any) {
      log("error", "Deploy oracle failed", error);
      setTxStatus({
        status: "error",
        error: error?.message || "Failed to deploy oracle",
      });
    }
  }, [connection]);

  // Get selected basket
  const selectedBasket = useMemo(() => {
    return baskets.find((b) => b.basketId === selectedBasketId);
  }, [baskets, selectedBasketId]);

  // Get user's vault for selected basket
  const userVault = useMemo(() => {
    return userVaults.find((v) => v.basketId === selectedBasketId);
  }, [userVaults, selectedBasketId]);

  // Get prices
  const adaPrice = oraclePrices.find((p) => p.assetId === "ADA")?.priceUsd || 0.5;
  const basketPrice = selectedBasket?.price || 0;

  // Calculate vault metrics
  const vaultCollateral = userVault?.collateralAda || 0;
  const vaultMintedTokens = userVault?.mintedTokens || 0;
  const collateralValueUsd = vaultCollateral * adaPrice;
  const debtValueUsd = vaultMintedTokens * basketPrice;
  const collateralRatio = debtValueUsd > 0 ? (collateralValueUsd / debtValueUsd) * 100 : Infinity;
  const isHealthy = collateralRatio >= 150;

  // Calculate required collateral for mint
  // Tokens use 6 decimals: 1 token = 1,000,000 units on-chain
  // Minimum: 0.000001 tokens (1 unit)
  const mintAmountNum = parseFloat(mintAmount) || 0;
  const mintAmountUnits = tokenToUnits(mintAmountNum);  // Convert to on-chain units
  const isMintAmountValid = mintAmountUnits >= 1n;  // At least 1 unit
  const mintValueUsd = mintAmountNum * basketPrice;  // Use display amount for USD calc
  const requiredCollateralUsd = mintValueUsd * 1.5;
  const requiredCollateralAda = requiredCollateralUsd / adaPrice;

  // Calculate collateral released after burn
  const burnAmountNum = parseFloat(burnAmount) || 0;
  const burnAmountUnits = tokenToUnits(burnAmountNum);  // Convert to on-chain units
  const burnValueUsd = burnAmountNum * basketPrice;

  // Basket options for dropdown
  const basketOptions = baskets.map((b) => ({
    value: b.basketId,
    label: b.name,
  }));

  const handleMint = useCallback(async () => {
    if (!connection || !mintAmount || !selectedBasket) return;

    try {
      setTxStatus({ status: "building", message: "Building mint transaction..." });
      log("info", "Minting tokens", { amount: mintAmount, basket: selectedBasketId });

      const txBuilder = new EquiBasketTxBuilder(
        connection.lucid,
        connection.address,
        connection.pkh
      );

      // Get required UTxOs
      const [vaultUtxos, oracleUtxos, basketUtxos] = await Promise.all([
        txBuilder.getVaultUtxos(),
        txBuilder.getOracleUtxos(),
        txBuilder.getBasketUtxos(),
      ]);

      if (vaultUtxos.length === 0) {
        throw new Error("No vault found. Please open a vault first by depositing collateral.");
      }
      if (oracleUtxos.length === 0) {
        throw new Error("Oracle not found. Please deploy the oracle first.");
      }
      if (basketUtxos.length === 0) {
        throw new Error("Basket not found on-chain.");
      }

      // Validate mint amount is at least 1 unit (0.000001 tokens)
      if (mintAmountUnits < 1n) {
        throw new Error("Mint amount must be at least 0.000001 tokens.");
      }

      // Use the LAST oracle UTxO (most recently deployed)
      // Old UTxOs may have incorrect datum encoding from before the tuple fix
      const oracleUtxo = oracleUtxos[oracleUtxos.length - 1];

      // Find the basket UTxO that matches the selected basket_id
      const basketUtxo = basketUtxos.find((utxo) => {
        if (!utxo.datum) return false;
        try {
          const datum = decodeBasketDatum(utxo.datum);
          return datum.basket_id === selectedBasketId;
        } catch {
          return false;
        }
      });

      if (!basketUtxo) {
        throw new Error(`Basket UTxO not found for basket_id: ${selectedBasketId}`);
      }

      // Find the vault UTxO that matches the selected basket_id
      const vaultUtxo = vaultUtxos.find((utxo) => {
        if (!utxo.datum) return false;
        try {
          const datum = decodeVaultDatum(utxo.datum);
          return datum.basket_id === selectedBasketId;
        } catch {
          return false;
        }
      });

      if (!vaultUtxo) {
        throw new Error(`Vault UTxO not found for basket_id: ${selectedBasketId}`);
      }

      console.log("basketUtxo.datum", basketUtxo.datum)

      if (oracleUtxos.length > 1) {
        log("warn", `Multiple oracle UTxOs found (${oracleUtxos.length}). Using most recent.`);
      }

      const tx = await txBuilder.mintBasketTokens(
        vaultUtxo,
        oracleUtxo,
        basketUtxo,
        mintAmountUnits
      );

      setTxStatus({ status: "signing", message: "Waiting for wallet signature..." });
      const txHash = await submitTx(tx);

      // Update vault in database (store display amount)
      if (userVault?.id) {
        await updateVaultPosition(
          userVault.id,
          vaultCollateral,
          vaultMintedTokens + mintAmountNum,
          txHash
        );
      }

      setTxStatus({
        status: "success",
        txHash,
        message: `Successfully minted ${mintAmountNum} ${selectedBasket.name} tokens!`,
      });

      setMintAmount("");
      refreshVaults(connection.address);
    } catch (error: any) {
      log("error", "Mint failed", error);
      setTxStatus({
        status: "error",
        error: error?.message || "Mint transaction failed",
      });
    }
  }, [connection, mintAmount, mintAmountNum, mintAmountUnits, selectedBasket, selectedBasketId, userVault, vaultCollateral, vaultMintedTokens, updateVaultPosition, refreshVaults]);

  const handleBurn = useCallback(async () => {
    if (!connection || !burnAmount || !selectedBasket) return;

    try {
      setTxStatus({ status: "building", message: "Building burn transaction..." });
      log("info", "Burning tokens", { amount: burnAmount, basket: selectedBasketId });

      const txBuilder = new EquiBasketTxBuilder(
        connection.lucid,
        connection.address,
        connection.pkh
      );

      const [vaultUtxos, oracleUtxos, basketUtxos] = await Promise.all([
        txBuilder.getVaultUtxos(),
        txBuilder.getOracleUtxos(),
        txBuilder.getBasketUtxos(),
      ]);

      if (vaultUtxos.length === 0) throw new Error("No vault found");
      if (oracleUtxos.length === 0) throw new Error("Oracle not found");
      if (basketUtxos.length === 0) throw new Error("Basket not found");

      // Use the LAST oracle UTxO (most recently deployed)
      const oracleUtxo = oracleUtxos[oracleUtxos.length - 1];

      // Find the basket UTxO that matches the selected basket_id
      const basketUtxo = basketUtxos.find((utxo) => {
        if (!utxo.datum) return false;
        try {
          const datum = decodeBasketDatum(utxo.datum);
          return datum.basket_id === selectedBasketId;
        } catch {
          return false;
        }
      });

      if (!basketUtxo) {
        throw new Error(`Basket UTxO not found for basket_id: ${selectedBasketId}`);
      }

      // Find the vault UTxO that matches the selected basket_id
      const vaultUtxo = vaultUtxos.find((utxo) => {
        if (!utxo.datum) return false;
        try {
          const datum = decodeVaultDatum(utxo.datum);
          return datum.basket_id === selectedBasketId;
        } catch {
          return false;
        }
      });

      if (!vaultUtxo) {
        throw new Error(`Vault UTxO not found for basket_id: ${selectedBasketId}`);
      }

      const tx = await txBuilder.burnBasketTokens(
        vaultUtxo,
        oracleUtxo,
        basketUtxo,
        burnAmountUnits
      );

      setTxStatus({ status: "signing", message: "Waiting for wallet signature..." });
      const txHash = await submitTx(tx);

      // Update vault in database (store display amount)
      if (userVault?.id) {
        await updateVaultPosition(
          userVault.id,
          vaultCollateral,
          vaultMintedTokens - burnAmountNum,
          txHash
        );
      }

      setTxStatus({
        status: "success",
        txHash,
        message: `Successfully burned ${burnAmount} ${selectedBasket.name} tokens!`,
      });

      setBurnAmount("");
      refreshVaults(connection.address);
    } catch (error: any) {
      log("error", "Burn failed", error);
      setTxStatus({
        status: "error",
        error: error?.message || "Burn transaction failed",
      });
    }
  }, [connection, burnAmount, burnAmountNum, burnAmountUnits, selectedBasket, selectedBasketId, userVault, vaultCollateral, vaultMintedTokens, updateVaultPosition, refreshVaults]);

  const handleOpenVault = useCallback(async () => {
    if (!connection || !depositAmount || !selectedBasketId) return;

    const depositAda = parseFloat(depositAmount);

    try {
      setTxStatus({ status: "building", message: "Opening vault..." });
      log("info", "Opening vault", { deposit: depositAmount, basket: selectedBasketId });

      const txBuilder = new EquiBasketTxBuilder(
        connection.lucid,
        connection.address,
        connection.pkh
      );

      const tx = await txBuilder.openVaultAndDeposit(
        selectedBasketId,
        adaToLovelace(depositAda)
      );

      setTxStatus({ status: "signing", message: "Waiting for wallet signature..." });
      const txHash = await submitTx(tx);

      // Save vault to database
      if (userVault) {
        // Update existing vault
        await updateVaultPosition(
          userVault.id!,
          vaultCollateral + depositAda,
          vaultMintedTokens,
          txHash
        );
      } else {
        // Create new vault
        await addVault({
          ownerAddress: connection.address,
          basketId: selectedBasketId,
          collateralAda: depositAda,
          mintedTokens: 0,
          txHash,
        });
      }

      setTxStatus({
        status: "success",
        txHash,
        message: `Vault opened with ${depositAmount} ADA collateral!`,
      });

      setDepositAmount("");
      refreshVaults(connection.address);
    } catch (error: any) {
      log("error", "Open vault failed", error);
      setTxStatus({
        status: "error",
        error: error?.message || "Failed to open vault",
      });
    }
  }, [connection, depositAmount, selectedBasketId, userVault, vaultCollateral, vaultMintedTokens, addVault, updateVaultPosition, refreshVaults]);

  if (!connection) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-slate-400">Please connect your wallet to mint or burn tokens.</p>
      </div>
    );
  }

  if (isLoading || checkingOracle) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">
          {checkingOracle ? "Checking oracle status..." : "Loading baskets..."}
        </p>
      </div>
    );
  }

  if (baskets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">No Baskets Available</h2>
        <p className="text-slate-400 mb-6">Create a basket first before you can mint tokens.</p>
        <a href="/create">
          <Button>Create Basket</Button>
        </a>
      </div>
    );
  }

  // Show oracle deployment UI if oracle is not deployed
  if (oracleDeployed === false) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        {/* Transaction Status */}
        {txStatus.status !== "idle" && (
          <div className="mb-6">
            <TransactionStatus
              status={txStatus}
              onClose={() => setTxStatus({ status: "idle" })}
            />
          </div>
        )}

        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Oracle Not Deployed</h2>
            <p className="text-slate-400 mb-2">
              The price oracle needs to be deployed before you can mint or burn tokens.
            </p>
            <p className="text-slate-500 text-sm mb-6">
              The oracle provides price feeds for assets (BTC, ETH, SOL, ADA, LINK, DOT) that are used to calculate basket values and collateral requirements.
            </p>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
              <div className="text-sm font-medium text-white mb-2">Default Oracle Prices:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">BTC</span><span className="text-white">$60,000</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ETH</span><span className="text-white">$3,000</span></div>
                <div className="flex justify-between"><span className="text-slate-400">SOL</span><span className="text-white">$150</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ADA</span><span className="text-white">$0.50</span></div>
                <div className="flex justify-between"><span className="text-slate-400">LINK</span><span className="text-white">$15</span></div>
                <div className="flex justify-between"><span className="text-slate-400">DOT</span><span className="text-white">$7</span></div>
              </div>
            </div>

            <Button
              onClick={handleDeployOracle}
              disabled={
                txStatus.status === "building" ||
                txStatus.status === "signing" ||
                txStatus.status === "submitting"
              }
              isLoading={
                txStatus.status === "building" ||
                txStatus.status === "signing" ||
                txStatus.status === "submitting"
              }
            >
              Deploy Oracle
            </Button>

            <p className="text-slate-500 text-xs mt-4">
              This transaction requires ~5 ADA for the UTxO minimum and transaction fees.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Mint & Burn Synthetic Baskets</h1>
        <p className="text-slate-400 mt-2">
          Deposit collateral to mint synthetic basket tokens, or burn tokens to withdraw collateral.
        </p>
      </div>

      {/* Transaction Status */}
      {txStatus.status !== "idle" && (
        <div className="mb-6">
          <TransactionStatus
            status={txStatus}
            onClose={() => setTxStatus({ status: "idle" })}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basket Selection */}
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Select eBasket"
                  options={basketOptions}
                  value={selectedBasketId}
                  onChange={(e) => setSelectedBasketId(e.target.value)}
                  placeholder="Choose a basket"
                />
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Oracle Price</div>
                <div className="text-2xl font-bold text-white">
                  ${basketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  Required Collateral Ratio: <span className="text-white">150%</span>
                </div>
              </div>
            </div>

            {selectedBasket && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Basket Composition:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedBasket.assets.map((asset) => (
                    <span key={asset.id} className="px-2 py-1 bg-slate-700 rounded text-sm text-white">
                      {asset.id}: {asset.weight / 100}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Mint / Burn Tabs */}
          <Card>
            <Tabs defaultValue="mint">
              <TabsList>
                <Tab value="mint">Mint</Tab>
                <Tab value="burn">Burn</Tab>
                <Tab value="deposit">Deposit</Tab>
              </TabsList>

              {/* Mint Tab */}
              <TabPanel value="mint">
                <div className="space-y-4">
                  <Input
                    label="Amount to Mint"
                    type="number"
                    placeholder="0.001"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    suffix="tokens"
                    hint={`Supports up to ${TOKEN_DECIMALS} decimals (e.g., 0.001, 0.5, 1.0)`}
                    error={mintAmount && !isMintAmountValid ? "Amount must be at least 0.000001 tokens" : undefined}
                  />

                  <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Mint Value</span>
                      <span className="text-white">
                        ${mintValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Required Collateral (150%)</span>
                      <span className="text-white">
                        {requiredCollateralAda.toLocaleString(undefined, { maximumFractionDigits: 2 })} ADA
                      </span>
                    </div>
                  </div>

                  <Button
                    fullWidth
                    onClick={handleMint}
                    disabled={
                      !mintAmount ||
                      !isMintAmountValid ||
                      !userVault ||
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                    isLoading={
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                  >
                    {userVault ? `Mint ${selectedBasket?.name || "Tokens"}` : "Open Vault First"}
                  </Button>
                </div>
              </TabPanel>

              {/* Burn Tab */}
              <TabPanel value="burn">
                <div className="space-y-4">
                  <Input
                    label="Amount to Burn"
                    type="number"
                    placeholder="0.00"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    suffix="tokens"
                    hint={`You have ${vaultMintedTokens} tokens minted`}
                  />

                  <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Burn Value</span>
                      <span className="text-white">
                        ${burnValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Collateral Released</span>
                      <span className="text-green-400">
                        +{((burnValueUsd * 1.5) / adaPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })} ADA
                      </span>
                    </div>
                  </div>

                  <Button
                    fullWidth
                    variant="danger"
                    onClick={handleBurn}
                    disabled={
                      !burnAmount ||
                      parseFloat(burnAmount) <= 0 ||
                      burnAmountNum > vaultMintedTokens ||
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                    isLoading={
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                  >
                    Burn Tokens
                  </Button>
                </div>
              </TabPanel>

              {/* Deposit Tab */}
              <TabPanel value="deposit">
                <div className="space-y-4">
                  <Input
                    label="Deposit Amount"
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    suffix="ADA"
                    hint="Minimum deposit: 2 ADA"
                  />

                  <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current Collateral</span>
                      <span className="text-white">
                        {vaultCollateral.toLocaleString()} ADA
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">After Deposit</span>
                      <span className="text-green-400">
                        {(vaultCollateral + (parseFloat(depositAmount) || 0)).toLocaleString()} ADA
                      </span>
                    </div>
                  </div>

                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={handleOpenVault}
                    disabled={
                      !depositAmount ||
                      parseFloat(depositAmount) < 2 ||
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                    isLoading={
                      txStatus.status === "building" ||
                      txStatus.status === "signing" ||
                      txStatus.status === "submitting"
                    }
                  >
                    {userVault ? "Add Collateral" : "Open Vault"}
                  </Button>
                </div>
              </TabPanel>
            </Tabs>
          </Card>
        </div>

        {/* Vault Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardTitle>My Vault</CardTitle>

            {userVault ? (
              <div className="space-y-4 mt-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Collateral</span>
                  <span className="text-white font-medium">
                    {vaultCollateral.toLocaleString()} ADA
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Collateral Value</span>
                  <span className="text-white font-medium">
                    ${collateralValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Debt Value</span>
                  <span className="text-white font-medium">
                    ${debtValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Minted Tokens</span>
                  <span className="text-white font-medium">
                    {vaultMintedTokens}
                  </span>
                </div>

                <hr className="border-slate-700" />

                <CollateralRatioBar ratio={collateralRatio} threshold={150} />

                {!isHealthy && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    ⚠️ Your vault is below the 150% collateral ratio. Add collateral or burn tokens to avoid liquidation.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">
                  No vault for this basket. Deposit collateral to open one.
                </p>
              </div>
            )}
          </Card>

          {/* Oracle Prices */}
          <Card>
            <CardTitle>Oracle Prices</CardTitle>
            <div className="space-y-3 mt-4">
              {oraclePrices.map((price) => (
                <div key={price.assetId} className="flex justify-between text-sm">
                  <span className="text-slate-400">{price.assetId}</span>
                  <span className="text-white">
                    ${price.priceUsd.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MintBurnPage;
