"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import WalletProvider from "@/components/connection/Provider";
import { ToastProvider } from "@/components/ui/Toast";
import { DatabaseProvider } from "@/components/database/DatabaseProvider";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <DatabaseProvider>
          <WalletProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </WalletProvider>
        </DatabaseProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
