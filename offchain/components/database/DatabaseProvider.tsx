// Database Context Provider

"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  initializeDatabase,
  getAllBaskets,
  getBasketsByCreator,
  createBasket as dbCreateBasket,
  updateBasketTxHash,
  getOraclePrices,
  getVaultsByOwner,
  createVault as dbCreateVault,
  updateVault,
  calculateBasketPrice,
  parseAssetsJson,
  stringifyAssets,
  isDatabaseConfigured,
  BasketRecord,
  OraclePriceRecord,
  UserVaultRecord,
  BasketAsset,
} from "@/lib/database";

// =============================================================================
// TYPES
// =============================================================================

export interface Basket {
  id?: number;
  basketId: string;
  name: string;
  description?: string;
  assets: BasketAsset[];
  creatorAddress: string;
  txHash?: string;
  createdAt: Date;
  price?: number;  // Calculated from oracle
}

export interface OraclePrice {
  assetId: string;
  assetName: string;
  priceUsd: number;
  updatedAt: Date;
}

export interface Vault {
  id?: number;
  ownerAddress: string;
  basketId: string;
  collateralAda: number;
  mintedTokens: number;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseContextType {
  // State
  baskets: Basket[];
  oraclePrices: OraclePrice[];
  userVaults: Vault[];
  isLoading: boolean;
  error: string | null;
  isConfigured: boolean;  // Whether database is configured
  
  // Actions
  refreshBaskets: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  refreshVaults: (ownerAddress: string) => Promise<void>;
  addBasket: (basket: Omit<Basket, "id" | "createdAt" | "price">) => Promise<Basket>;
  updateBasketTransaction: (basketId: string, txHash: string) => Promise<void>;
  addVault: (vault: Omit<Vault, "id" | "createdAt" | "updatedAt">) => Promise<Vault>;
  updateVaultPosition: (vaultId: number, collateral: number, minted: number, txHash?: string) => Promise<void>;
  getBasketPrice: (assets: BasketAsset[]) => Promise<number>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [oraclePrices, setOraclePrices] = useState<OraclePrice[]>([]);
  const [userVaults, setUserVaults] = useState<Vault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        
        // Check if database is configured
        const configured = isDatabaseConfigured();
        setIsConfigured(configured);
        
        if (!configured) {
          console.warn("[DatabaseProvider] Database not configured. Set NEXT_PUBLIC_TURSO_DATABASE_URL in .env.local");
          setError("Database not configured. Please set NEXT_PUBLIC_TURSO_DATABASE_URL in .env.local");
          setIsLoading(false);
          return;
        }
        
        await initializeDatabase();
        setInitialized(true);
        console.log("[DatabaseProvider] Database initialized");
      } catch (err: any) {
        console.error("[DatabaseProvider] Failed to initialize:", err);
        setError(err?.message || "Failed to initialize database");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Load initial data once initialized
  useEffect(() => {
    if (initialized && isConfigured) {
      refreshBaskets();
      refreshPrices();
    }
  }, [initialized, isConfigured]);

  // =============================================================================
  // REFRESH FUNCTIONS
  // =============================================================================

  const refreshBaskets = useCallback(async () => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Skipping refreshBaskets - database not configured");
      return;
    }
    try {
      const records = await getAllBaskets();
      const prices = await getOraclePrices();
      const priceMap = new Map(prices.map((p) => [p.asset_id, p.price_usd]));
      
      const basketsWithPrices: Basket[] = await Promise.all(
        records.map(async (record) => {
          const assets = parseAssetsJson(record.assets_json);
          let price = 0;
          for (const asset of assets) {
            const assetPrice = priceMap.get(asset.id) || 0;
            price += (assetPrice * asset.weight) / 10000;
          }
          
          return {
            id: record.id,
            basketId: record.basket_id,
            name: record.name,
            description: record.description,
            assets,
            creatorAddress: record.creator_address,
            txHash: record.tx_hash,
            createdAt: new Date(record.created_at),
            price,
          };
        })
      );
      
      setBaskets(basketsWithPrices);
      console.log("[DatabaseProvider] Baskets refreshed:", basketsWithPrices.length);
    } catch (err: any) {
      console.error("[DatabaseProvider] Failed to refresh baskets:", err);
      setError(err?.message || "Failed to load baskets");
    }
  }, [isConfigured]);

  const refreshPrices = useCallback(async () => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Skipping refreshPrices - database not configured");
      return;
    }
    try {
      const records = await getOraclePrices();
      const prices: OraclePrice[] = records.map((record) => ({
        assetId: record.asset_id,
        assetName: record.asset_name,
        priceUsd: record.price_usd,
        updatedAt: new Date(record.updated_at),
      }));
      
      setOraclePrices(prices);
      console.log("[DatabaseProvider] Prices refreshed:", prices.length);
    } catch (err: any) {
      console.error("[DatabaseProvider] Failed to refresh prices:", err);
    }
  }, [isConfigured]);

  const refreshVaults = useCallback(async (ownerAddress: string) => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Skipping refreshVaults - database not configured");
      return;
    }
    try {
      const records = await getVaultsByOwner(ownerAddress);
      const vaults: Vault[] = records.map((record) => ({
        id: record.id,
        ownerAddress: record.owner_address,
        basketId: record.basket_id,
        collateralAda: record.collateral_ada,
        mintedTokens: record.minted_tokens,
        txHash: record.tx_hash,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
      }));
      
      setUserVaults(vaults);
      console.log("[DatabaseProvider] Vaults refreshed:", vaults.length);
    } catch (err: any) {
      console.error("[DatabaseProvider] Failed to refresh vaults:", err);
    }
  }, [isConfigured]);

  // =============================================================================
  // ACTION FUNCTIONS
  // =============================================================================

  const addBasket = useCallback(async (
    basket: Omit<Basket, "id" | "createdAt" | "price">
  ): Promise<Basket> => {
    if (!isConfigured) {
      throw new Error("Database not configured. Cannot add basket.");
    }
    
    const record: Omit<BasketRecord, "id"> = {
      basket_id: basket.basketId,
      name: basket.name,
      description: basket.description,
      assets_json: stringifyAssets(basket.assets),
      creator_address: basket.creatorAddress,
      tx_hash: basket.txHash,
      created_at: Date.now(),
    };
    
    const created = await dbCreateBasket(record);
    const price = await calculateBasketPrice(basket.assets);
    
    const newBasket: Basket = {
      id: created.id,
      basketId: basket.basketId,
      name: basket.name,
      description: basket.description,
      assets: basket.assets,
      creatorAddress: basket.creatorAddress,
      txHash: basket.txHash,
      createdAt: new Date(created.created_at),
      price,
    };
    
    setBaskets((prev) => [newBasket, ...prev]);
    console.log("[DatabaseProvider] Basket added:", newBasket.basketId);
    
    return newBasket;
  }, [isConfigured]);

  const updateBasketTransaction = useCallback(async (basketId: string, txHash: string) => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Skipping updateBasketTransaction - database not configured");
      return;
    }
    await updateBasketTxHash(basketId, txHash);
    setBaskets((prev) =>
      prev.map((b) => (b.basketId === basketId ? { ...b, txHash } : b))
    );
    console.log("[DatabaseProvider] Basket transaction updated:", basketId);
  }, [isConfigured]);

  const addVault = useCallback(async (
    vault: Omit<Vault, "id" | "createdAt" | "updatedAt">
  ): Promise<Vault> => {
    if (!isConfigured) {
      throw new Error("Database not configured. Cannot add vault.");
    }
    
    const now = Date.now();
    const record: Omit<UserVaultRecord, "id"> = {
      owner_address: vault.ownerAddress,
      basket_id: vault.basketId,
      collateral_ada: vault.collateralAda,
      minted_tokens: vault.mintedTokens,
      tx_hash: vault.txHash,
      created_at: now,
      updated_at: now,
    };
    
    const created = await dbCreateVault(record);
    
    const newVault: Vault = {
      id: created.id,
      ownerAddress: vault.ownerAddress,
      basketId: vault.basketId,
      collateralAda: vault.collateralAda,
      mintedTokens: vault.mintedTokens,
      txHash: vault.txHash,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    
    setUserVaults((prev) => [newVault, ...prev]);
    console.log("[DatabaseProvider] Vault added:", newVault.basketId);
    
    return newVault;
  }, [isConfigured]);

  const updateVaultPosition = useCallback(async (
    vaultId: number,
    collateral: number,
    minted: number,
    txHash?: string
  ) => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Skipping updateVaultPosition - database not configured");
      return;
    }
    await updateVault(vaultId, {
      collateral_ada: collateral,
      minted_tokens: minted,
      tx_hash: txHash,
    });
    
    setUserVaults((prev) =>
      prev.map((v) =>
        v.id === vaultId
          ? { ...v, collateralAda: collateral, mintedTokens: minted, txHash, updatedAt: new Date() }
          : v
      )
    );
    console.log("[DatabaseProvider] Vault updated:", vaultId);
  }, [isConfigured]);

  const getBasketPrice = useCallback(async (assets: BasketAsset[]): Promise<number> => {
    if (!isConfigured) {
      console.warn("[DatabaseProvider] Database not configured, returning 0 for basket price");
      return 0;
    }
    return await calculateBasketPrice(assets);
  }, [isConfigured]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const value: DatabaseContextType = {
    baskets,
    oraclePrices,
    userVaults,
    isLoading,
    error,
    isConfigured,
    refreshBaskets,
    refreshPrices,
    refreshVaults,
    addBasket,
    updateBasketTransaction,
    addVault,
    updateVaultPosition,
    getBasketPrice,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within DatabaseProvider");
  }
  return context;
}

export default DatabaseProvider;

