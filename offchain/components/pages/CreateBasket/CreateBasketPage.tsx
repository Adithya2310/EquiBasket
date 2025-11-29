// Create Basket Page

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/connection/context";
import { useDatabase } from "@/components/database/DatabaseProvider";
import { Button, Card, CardTitle, CardDescription, Input } from "@/components/ui";
import { TransactionStatus } from "@/components/shared/TransactionStatus";
import { PieChart } from "@/components/shared/PieChart";
import { EquiBasketTxBuilder, submitTx, log } from "@/lib/tx-builder";
import type { TxStatus } from "@/types/equibasket";

interface BasketAsset {
  id: string;
  weight: number;
}

// Asset colors for display
const ASSET_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#00FFA3",
  ADA: "#0033AD",
  LINK: "#2A5ADA",
  DOT: "#E6007A",
  Gold: "#FFD700",
  Silver: "#C0C0C0",
  AAPL: "#A2AAAD",
  MSFT: "#F25022",
  GOOGL: "#4285F4",
  AMZN: "#FF9900",
  NVDA: "#76B900",
  META: "#0668E1",
  TSLA: "#E31937",
};

export function CreateBasketPage() {
  const router = useRouter();
  const [connection] = useWallet();
  const { oraclePrices, addBasket, updateBasketTransaction, getBasketPrice } = useDatabase();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const [basketName, setBasketName] = useState("");
  const [description, setDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<BasketAsset[]>([]);

  // Get available assets from oracle prices
  const availableAssets = oraclePrices.map((p) => ({
    id: p.assetId,
    name: p.assetName,
    color: ASSET_COLORS[p.assetId] || "#666",
    priceUsd: p.priceUsd,
  }));

  const filteredAssets = availableAssets.filter(
    (asset) =>
      (asset.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !selectedAssets.some((s) => s.id === asset.id)
  );

  const totalWeight = selectedAssets.reduce((sum, a) => sum + a.weight, 0);
  const isValidWeights = totalWeight === 10000;

  const addAsset = useCallback((assetId: string) => {
    setSelectedAssets((prev) => {
      const remaining = 10000 - prev.reduce((sum, a) => sum + a.weight, 0);
      return [...prev, { id: assetId, weight: Math.min(remaining, 3333) }];
    });
  }, []);

  const removeAsset = useCallback((assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId));
  }, []);

  const updateWeight = useCallback((assetId: string, weight: number) => {
    setSelectedAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, weight } : a))
    );
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedAssets([]);
    setBasketName("");
    setDescription("");
  }, []);

  const handleCreateBasket = useCallback(async () => {
    if (!connection || !basketName || selectedAssets.length === 0 || !isValidWeights) {
      log("warn", "Invalid basket configuration");
      return;
    }

    // Generate unique basket ID
    const basketId = `${basketName.toUpperCase().replace(/\s+/g, "_")}_${Date.now().toString(36)}`;

    try {
      // Step 1: Save to database first (optimistic)
      log("info", "Saving basket to database", { basketId, name: basketName, assets: selectedAssets });

      const savedBasket = await addBasket({
        basketId,
        name: basketName,
        description: description || undefined,
        assets: selectedAssets,
        creatorAddress: connection.address,
      });

      log("info", "Basket saved to database", { id: savedBasket.id });

      // Step 2: Build and submit on-chain transaction
      setTxStatus({ status: "building", message: "Building transaction..." });

      const txBuilder = new EquiBasketTxBuilder(
        connection.lucid,
        connection.address,
        connection.pkh
      );

      const tx = await txBuilder.createBasket(basketId, basketName, selectedAssets);

      setTxStatus({ status: "signing", message: "Waiting for wallet signature..." });
      const txHash = await submitTx(tx);

      // Step 3: Update database with transaction hash
      await updateBasketTransaction(basketId, txHash);

      setTxStatus({
        status: "success",
        txHash,
        message: "Basket created successfully!",
      });

      log("info", "Basket created on-chain", { basketId, txHash });

      // Redirect after success
      setTimeout(() => router.push("/"), 3000);
    } catch (error: any) {
      log("error", "Failed to create basket", error);
      setTxStatus({
        status: "error",
        error: error?.message || "Transaction failed",
      });
    }
  }, [connection, basketName, description, selectedAssets, isValidWeights, router, addBasket, updateBasketTransaction]);

  // Calculate estimated price from oracle
  const estimatedPrice = selectedAssets.reduce((total, asset) => {
    const oraclePrice = oraclePrices.find((p) => p.assetId === asset.id);
    if (oraclePrice) {
      return total + (oraclePrice.priceUsd * asset.weight) / 10000;
    }
    return total;
  }, 0);

  // Pie chart data
  const pieData = selectedAssets.map((asset) => {
    const assetInfo = availableAssets.find((a) => a.id === asset.id);
    return {
      label: `${assetInfo?.name || asset.id} (${asset.id})`,
      value: asset.weight,
      color: assetInfo?.color || "#666",
    };
  });

  if (!connection) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">
          Connect Your Wallet
        </h2>
        <p className="text-slate-400">
          Please connect your wallet to create a basket.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Create a New Equity Basket
        </h1>
        <p className="text-slate-400 mt-2">
          Define your own synthetic equity basket by naming it, adding assets,
          and assigning weights.
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

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Basket Name */}
          <Input
            label="Basket Name"
            placeholder="e.g., 'My Tech Giants'"
            value={basketName}
            onChange={(e) => setBasketName(e.target.value)}
          />

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Basket Description (Optional)
            </label>
            <textarea
              placeholder="Enter a short description for your new basket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-24"
            />
          </div>

          {/* Add Assets */}
          <div className="space-y-4">
            <h3 className="font-medium text-white">Add Assets to Basket</h3>

            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by asset name or ticker (e.g., BTC)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Search Results */}
            {searchTerm && filteredAssets.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                {filteredAssets.slice(0, 4).map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      addAsset(asset.id);
                      setSearchTerm("");
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: asset.color }}
                      >
                        {asset.id.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">{asset.id}</div>
                        <div className="text-xs text-slate-400">{asset.name} - ${asset.priceUsd.toLocaleString()}</div>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {availableAssets.length === 0 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">
                Loading asset prices from database...
              </div>
            )}
          </div>

          {/* Selected Assets */}
          {selectedAssets.length > 0 && (
            <div className="space-y-3">
              {selectedAssets.map((asset) => {
                const assetInfo = availableAssets.find((a) => a.id === asset.id);
                return (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 p-3 bg-slate-800 border border-slate-700 rounded-lg"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: assetInfo?.color || "#666" }}
                    >
                      {asset.id.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{asset.id}</div>
                      <div className="text-xs text-slate-400">
                        {assetInfo?.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={asset.weight / 100}
                        onChange={(e) =>
                          updateWeight(asset.id, Number(e.target.value) * 100)
                        }
                        className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-center text-sm"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Preview */}
        <div>
          <Card className="sticky top-24">
            <CardTitle>Preview Basket Composition</CardTitle>
            <CardDescription className="mb-6">
              Ensure weights sum to 100% before creating
            </CardDescription>

            {selectedAssets.length > 0 ? (
              <>
                <PieChart
                  data={pieData}
                  size={220}
                  innerRadius={70}
                  centerText={`${(totalWeight / 100).toFixed(0)}%`}
                  centerSubtext="Total Weight"
                />

                <div className="mt-6 space-y-4">
                  {!isValidWeights && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                      Weights must sum to exactly 100% (currently {totalWeight / 100}%)
                    </div>
                  )}

                  <div className="p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">
                      Estimated Basket Price
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${estimatedPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <Button
                    fullWidth
                    onClick={handleCreateBasket}
                    disabled={
                      !basketName ||
                      selectedAssets.length === 0 ||
                      !isValidWeights ||
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
                    Create Basket
                  </Button>

                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={clearSelections}
                    disabled={selectedAssets.length === 0}
                  >
                    Clear Selections
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <p className="text-slate-400">
                  Search and add assets to see the composition preview
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CreateBasketPage;
