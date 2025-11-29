// Main App Component with Routing

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Lucid, paymentCredentialOf, stakeCredentialOf } from "@evolution-sdk/lucid";

import { Wallet } from "@/types/cardano";
import { Connection, useWallet } from "@/components/connection/context";
import { getErrorMessage } from "@/components/utils";
import { network, provider } from "@/config/lucid";
import { Navbar } from "@/components/shared/Navbar";
import { log } from "@/lib/tx-builder";

// Pages
import { LandingPage } from "@/components/pages/Landing/LandingPage";
import { DashboardPage } from "@/components/pages/Dashboard/DashboardPage";
import { CreateBasketPage } from "@/components/pages/CreateBasket/CreateBasketPage";
import { MintBurnPage } from "@/components/pages/MintBurn/MintBurnPage";
import { TradePage } from "@/components/pages/Trade/TradePage";
import WalletConnector from "@/components/pages/Home/WalletConnector";
import { Modal, Button } from "@/components/ui";

export default function Home() {
  const pathname = usePathname();
  const [connection, setConnection] = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectWallet(wallet: Wallet): Promise<Connection> {
    log("info", "Connecting wallet...", { wallet: wallet.name });
    
    const [api, lucid] = await Promise.all([wallet.enable(), Lucid(provider, network)]);

    lucid.selectWallet.fromAPI(api);

    const [address, stakeAddress] = await Promise.all([
      lucid.wallet().address(),
      lucid.wallet().rewardAddress(),
    ]);

    const pkh = paymentCredentialOf(address).hash;
    const skh = stakeAddress ? stakeCredentialOf(stakeAddress).hash : null;

    log("info", "Wallet connected", { address, pkh });

    return { api, lucid, address, pkh, stakeAddress, skh };
  }

  const onConnectWallet = async (wallet: Wallet) => {
    try {
      setError(null);
      const conn = await connectWallet(wallet);
      setConnection(conn);
      setShowWalletModal(false);
    } catch (error: any) {
      log("error", "Failed to connect wallet", error);
      const msg = await getErrorMessage(error);
      setError(msg);
    }
  };

  const handleOpenWalletModal = () => {
    setShowWalletModal(true);
    setError(null);
  };

  // Determine which page to render based on pathname
  const renderPage = () => {
    // If on homepage and not connected, show landing page
    if (pathname === "/" && !connection) {
      return (
        <LandingPage
          onConnectWallet={handleOpenWalletModal}
          isConnected={!!connection}
        />
      );
    }

    // Otherwise render based on route
    switch (pathname) {
      case "/":
        return <DashboardPage />;
      case "/create":
        return <CreateBasketPage />;
      case "/mint-burn":
        return <MintBurnPage />;
      case "/trade":
        return <TradePage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <Navbar onConnectWallet={handleOpenWalletModal} />

      {/* Main Content with top padding for fixed navbar */}
      <main className="pt-16">
        {renderPage()}
      </main>

      {/* Wallet Connection Modal */}
      <Modal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        title="Connect Wallet"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Select a wallet to connect to EquiBasket on {network}.
          </p>
          
          <WalletConnector onConnectWallet={onConnectWallet} />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
