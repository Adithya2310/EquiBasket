// Dashboard Page - Shows user's portfolio and vaults

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/components/connection/context";
import { useDatabase } from "@/components/database/DatabaseProvider";
import { Button, Card, CardTitle, CardContent } from "@/components/ui";
import { CollateralRatioBar } from "@/components/shared/CollateralRatioBar";
import { TransactionStatus } from "@/components/shared/TransactionStatus";
import { lovelaceToAda, log } from "@/lib/tx-builder";
import type { TxStatus } from "@/types/equibasket";

export function DashboardPage() {
  const [connection] = useWallet();
  const { baskets, oraclePrices, userVaults, isLoading, refreshVaults, refreshBaskets } = useDatabase();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });
  const [balance, setBalance] = useState<bigint>(0n);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Get ADA price from oracle
  const adaPrice = oraclePrices.find((p) => p.assetId === "ADA")?.priceUsd || 0.5;

  useEffect(() => {
    if (connection) {
      fetchBalance();
      refreshVaults(connection.address);
    }
  }, [connection, refreshVaults]);

  async function fetchBalance() {
    if (!connection) return;

    setLoadingBalance(true);
    try {
      log("info", "Fetching wallet balance...");
      const utxos = await connection.lucid.wallet().getUtxos();
      const totalLovelace = utxos.reduce(
        (sum, utxo) => sum + utxo.assets.lovelace,
        0n
      );
      setBalance(totalLovelace);
      log("info", "Wallet balance fetched", { balance: totalLovelace });
    } catch (error) {
      log("error", "Failed to fetch balance", error);
    } finally {
      setLoadingBalance(false);
    }
  }

  if (!connection) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">
          Connect Your Wallet
        </h2>
        <p className="text-slate-400">
          Please connect your wallet to view your dashboard.
        </p>
      </div>
    );
  }

  // Calculate totals from vaults
  const totalCollateral = userVaults.reduce((sum, v) => sum + v.collateralAda, 0);
  const totalDebt = userVaults.reduce((sum, v) => {
    const basket = baskets.find((b) => b.basketId === v.basketId);
    return sum + v.mintedTokens * (basket?.price || 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Manage your baskets and monitor your positions
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/create">
            <Button>Create Basket</Button>
          </Link>
          <Link href="/mint-burn">
            <Button variant="secondary">Mint / Burn</Button>
          </Link>
        </div>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent>
            <div className="text-slate-400 text-sm mb-1">Wallet Balance</div>
            <div className="text-2xl font-bold text-white">
              {loadingBalance ? "..." : lovelaceToAda(balance).toLocaleString()} ₳
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-slate-400 text-sm mb-1">Total Collateral</div>
            <div className="text-2xl font-bold text-white">
              {totalCollateral.toLocaleString()} ₳
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-slate-400 text-sm mb-1">Active Vaults</div>
            <div className="text-2xl font-bold text-white">{userVaults.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-slate-400 text-sm mb-1">ADA Price (Oracle)</div>
            <div className="text-2xl font-bold text-green-400">
              ${adaPrice.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Baskets */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Available Baskets</h2>
          <button
            onClick={() => refreshBaskets()}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-400">Loading baskets...</p>
            </CardContent>
          </Card>
        ) : baskets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No Baskets Yet
              </h3>
              <p className="text-slate-400 mb-4">
                Create your first synthetic basket to get started.
              </p>
              <Link href="/create">
                <Button>Create Basket</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {baskets.map((basket) => (
              <Card key={basket.basketId} className="hover:border-blue-500/50 transition-colors">
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <CardTitle>{basket.name}</CardTitle>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        {basket.basketId}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">
                        ${(basket.price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-500">per token</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {basket.assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-400">{asset.id}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${asset.weight / 100}%` }}
                            />
                          </div>
                          <span className="text-white font-medium w-12 text-right">
                            {asset.weight / 100}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {basket.txHash && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <a
                        href={`https://preview.cardanoscan.io/transaction/${basket.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 font-mono truncate block"
                      >
                        TX: {basket.txHash.slice(0, 16)}...
                      </a>
                    </div>
                  )}

                  <Link href={`/mint-burn?basket=${basket.basketId}`} className="mt-4 block">
                    <Button variant="secondary" fullWidth size="sm">
                      Mint This Basket
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Your Vaults */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Your Vaults</h2>
        {userVaults.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No Vaults Yet
              </h3>
              <p className="text-slate-400 mb-4">
                Start by depositing collateral to mint synthetic baskets.
              </p>
              <Link href="/mint-burn">
                <Button>Open a Vault</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {userVaults.map((vault) => {
              const basket = baskets.find((b) => b.basketId === vault.basketId);
              const debtValue = vault.mintedTokens * (basket?.price || 0);
              const collateralValue = vault.collateralAda * adaPrice;
              const ratio = debtValue > 0 ? (collateralValue / debtValue) * 100 : Infinity;

              return (
                <Card key={vault.id}>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-medium">
                          {basket?.name || vault.basketId}
                        </h3>
                        <p className="text-sm text-slate-500 font-mono">
                          {vault.mintedTokens} tokens minted
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">
                          {vault.collateralAda.toLocaleString()} ₳
                        </div>
                        <div className="text-sm text-slate-400">Collateral</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <CollateralRatioBar ratio={ratio} threshold={150} />
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Link href={`/mint-burn?basket=${vault.basketId}`} className="flex-1">
                        <Button variant="secondary" size="sm" fullWidth>
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
