// Landing Page Component - Home

"use client";

import { Button } from "@/components/ui";
import Link from "next/link";

interface LandingPageProps {
  onConnectWallet: () => void;
  isConnected: boolean;
}

export function LandingPage({ onConnectWallet, isConnected }: LandingPageProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center px-6">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Trade Real-World Baskets.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Instantly, On-Chain.
            </span>
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Mint and trade synthetic equity baskets backed by ADA collateral.
            Access diversified portfolios in a decentralized way.
          </p>

          <div className="flex items-center justify-center gap-4">
            {isConnected ? (
              <Link href="/create">
                <Button size="lg">Get Started</Button>
              </Link>
            ) : (
              <Button size="lg" onClick={onConnectWallet}>
                Launch App
              </Button>
            )}
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg">
                Read the Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-medium uppercase tracking-wider text-sm">
              Features
            </span>
            <h2 className="text-4xl font-bold text-white mt-2">
              Why EquiBasket?
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              Discover the advantages of trading on a decentralized synthetic
              asset platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Decentralized & Secure
              </h3>
              <p className="text-slate-400 text-sm">
                Experience a trustless platform built on blockchain technology,
                ensuring security and transparency.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Synthetic Baskets
              </h3>
              <p className="text-slate-400 text-sm">
                Gain exposure to real-world equity baskets through tokenized
                synthetic assets.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                ADA Collateral
              </h3>
              <p className="text-slate-400 text-sm">
                Utilize a stable and reliable collateral system backed by ADA
                for minting synthetic tokens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-medium uppercase tracking-wider text-sm">
              Process
            </span>
            <h2 className="text-4xl font-bold text-white mt-2">How It Works</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
                <span className="text-blue-400 font-bold text-lg">1</span>
              </div>
              <h3 className="text-white font-semibold mb-2">Deposit ADA</h3>
              <p className="text-slate-400 text-sm">
                Deposit ADA collateral into a secure smart contract to get
                started.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
                <span className="text-cyan-400 font-bold text-lg">2</span>
              </div>
              <h3 className="text-white font-semibold mb-2">Create Basket</h3>
              <p className="text-slate-400 text-sm">
                Choose from pre-defined baskets or create your own custom basket
                of assets.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4">
                <span className="text-green-400 font-bold text-lg">3</span>
              </div>
              <h3 className="text-white font-semibold mb-2">
                Mint Synthetic Basket
              </h3>
              <p className="text-slate-400 text-sm">
                Mint tokenized synthetic baskets against your deposited
                collateral.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                <span className="text-purple-400 font-bold text-lg">4</span>
              </div>
              <h3 className="text-white font-semibold mb-2">
                Trade or Redeem
              </h3>
              <p className="text-slate-400 text-sm">
                Trade your synthetic baskets on our DEX or redeem them for the
                underlying collateral.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Trading?
          </h2>
          <p className="text-slate-400 mb-8">
            Connect your wallet and start building your synthetic portfolio
            today.
          </p>
          {isConnected ? (
            <Link href="/create">
              <Button size="lg">Create Your First Basket</Button>
            </Link>
          ) : (
            <Button size="lg" onClick={onConnectWallet}>
              Connect Wallet
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-400" />
            <span className="text-slate-400 text-sm">
              © 2024 EquiBasket. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              About
            </Link>
            <Link
              href="#"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Docs
            </Link>
            <Link
              href="#"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Community
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

