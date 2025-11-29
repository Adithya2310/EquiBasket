// Navbar Component

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/components/connection/context";
import { Button } from "@/components/ui";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Create Basket", href: "/create" },
  { label: "Mint & Burn", href: "/mint-burn" },
  { label: "Trade", href: "/trade" },
];

interface NavbarProps {
  onConnectWallet: () => void;
}

export function Navbar({ onConnectWallet }: NavbarProps) {
  const pathname = usePathname();
  const [connection] = useWallet();

  const isConnected = !!connection;
  const shortAddress = connection?.address
    ? `${connection.address.slice(0, 8)}...${connection.address.slice(-6)}`
    : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">EquiBasket</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "text-white bg-slate-800"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-slate-300 font-mono">
                  {shortAddress}
                </span>
              </div>
            ) : (
              <Button onClick={onConnectWallet} size="sm">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

