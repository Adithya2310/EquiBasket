// EquiBasket Database Service Layer
// Integrates with Turso (libSQL) database

// Use the web client for browser compatibility
// The /web variant supports only remote URLs: libsql:, wss:, ws:, https:, http:
import { createClient, Client } from "@libsql/client/web";

// =============================================================================
// TYPES
// =============================================================================

export interface BasketRecord {
  id?: number;
  basket_id: string;
  name: string;
  description?: string;
  assets_json: string;  // JSON string of BasketAsset[]
  creator_address: string;
  tx_hash?: string;
  created_at: number;
}

export interface OraclePriceRecord {
  asset_id: string;
  asset_name: string;
  price_usd: number;
  updated_at: number;
}

export interface UserVaultRecord {
  id?: number;
  owner_address: string;
  basket_id: string;
  collateral_ada: number;
  minted_tokens: number;
  tx_hash?: string;
  created_at: number;
  updated_at: number;
}

export interface BasketAsset {
  id: string;
  weight: number;
}

// =============================================================================
// DATABASE CLIENT
// =============================================================================

let dbClient: Client | null = null;

/**
 * Get or create the Turso database client.
 * 
 * For web/browser environments, only remote URLs are supported:
 * - libsql://[databaseName]-[org].turso.io
 * - https://...
 * - wss://...
 * 
 * Environment variables required:
 * - NEXT_PUBLIC_TURSO_DATABASE_URL: Your Turso database URL
 * - NEXT_PUBLIC_TURSO_AUTH_TOKEN: Your Turso auth token
 */
export function getDbClient(): Client {
  if (!dbClient) {
    const url = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL || "";
    const authToken = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN || "";

    if (!url) {
      throw new Error(
        "NEXT_PUBLIC_TURSO_DATABASE_URL is not set. " +
        "Please configure your Turso database URL in .env.local file. " +
        "Example: NEXT_PUBLIC_TURSO_DATABASE_URL=libsql://your-db-name-org.turso.io"
      );
    }

    // Validate URL scheme for web client
    const validSchemes = ["libsql:", "https:", "http:", "wss:", "ws:"];
    const urlScheme = url.split("//")[0] + "//";
    if (!validSchemes.some(scheme => url.startsWith(scheme.replace(":", "://")) || url.startsWith(scheme))) {
      throw new Error(
        `Invalid database URL scheme. Web client only supports: ${validSchemes.join(", ")}. ` +
        `Got: ${url}`
      );
    }

    dbClient = createClient({ url, authToken });
    console.log("[DB] Client created with URL:", url.split("@")[0] + "@***");
  }
  return dbClient;
}

/**
 * Check if database is configured
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_TURSO_DATABASE_URL;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export async function initializeDatabase(): Promise<void> {
  const client = getDbClient();

  // Create tables if they don't exist
  await client.batch([
    `CREATE TABLE IF NOT EXISTS baskets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      basket_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      assets_json TEXT NOT NULL,
      creator_address TEXT NOT NULL,
      tx_hash TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS oracle_prices (
      asset_id TEXT PRIMARY KEY,
      asset_name TEXT NOT NULL,
      price_usd REAL NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS user_vaults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_address TEXT NOT NULL,
      basket_id TEXT NOT NULL,
      collateral_ada REAL NOT NULL,
      minted_tokens REAL NOT NULL,
      tx_hash TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_baskets_creator ON baskets(creator_address)`,
    `CREATE INDEX IF NOT EXISTS idx_vaults_owner ON user_vaults(owner_address)`,
    `CREATE INDEX IF NOT EXISTS idx_vaults_basket ON user_vaults(basket_id)`,
  ]);

  // Seed default oracle prices if empty
  const pricesCount = await client.execute("SELECT COUNT(*) as count FROM oracle_prices");
  if (pricesCount.rows[0]?.count === 0) {
    await seedOraclePrices();
  }

  console.log("[DB] Database initialized successfully");
}

// =============================================================================
// BASKET OPERATIONS
// =============================================================================

export async function createBasket(basket: Omit<BasketRecord, "id">): Promise<BasketRecord> {
  const client = getDbClient();

  const result = await client.execute({
    sql: `INSERT INTO baskets (basket_id, name, description, assets_json, creator_address, tx_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      basket.basket_id,
      basket.name,
      basket.description || null,
      basket.assets_json,
      basket.creator_address,
      basket.tx_hash || null,
      basket.created_at,
    ],
  });

  console.log("[DB] Basket created:", basket.basket_id);

  return {
    ...basket,
    id: Number(result.lastInsertRowid),
  };
}

export async function getBasketById(basketId: string): Promise<BasketRecord | null> {
  const client = getDbClient();

  const result = await client.execute({
    sql: "SELECT * FROM baskets WHERE basket_id = ?",
    args: [basketId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as number,
    basket_id: row.basket_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    assets_json: row.assets_json as string,
    creator_address: row.creator_address as string,
    tx_hash: row.tx_hash as string | undefined,
    created_at: row.created_at as number,
  };
}

export async function getAllBaskets(): Promise<BasketRecord[]> {
  const client = getDbClient();

  const result = await client.execute("SELECT * FROM baskets ORDER BY created_at DESC");

  return result.rows.map((row) => ({
    id: row.id as number,
    basket_id: row.basket_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    assets_json: row.assets_json as string,
    creator_address: row.creator_address as string,
    tx_hash: row.tx_hash as string | undefined,
    created_at: row.created_at as number,
  }));
}

export async function getBasketsByCreator(creatorAddress: string): Promise<BasketRecord[]> {
  const client = getDbClient();

  const result = await client.execute({
    sql: "SELECT * FROM baskets WHERE creator_address = ? ORDER BY created_at DESC",
    args: [creatorAddress],
  });

  return result.rows.map((row) => ({
    id: row.id as number,
    basket_id: row.basket_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    assets_json: row.assets_json as string,
    creator_address: row.creator_address as string,
    tx_hash: row.tx_hash as string | undefined,
    created_at: row.created_at as number,
  }));
}

export async function updateBasketTxHash(basketId: string, txHash: string): Promise<void> {
  const client = getDbClient();

  await client.execute({
    sql: "UPDATE baskets SET tx_hash = ? WHERE basket_id = ?",
    args: [txHash, basketId],
  });

  console.log("[DB] Basket tx_hash updated:", basketId, txHash);
}

// =============================================================================
// ORACLE PRICE OPERATIONS
// =============================================================================

export async function getOraclePrices(): Promise<OraclePriceRecord[]> {
  const client = getDbClient();

  const result = await client.execute("SELECT * FROM oracle_prices ORDER BY asset_id");

  return result.rows.map((row) => ({
    asset_id: row.asset_id as string,
    asset_name: row.asset_name as string,
    price_usd: row.price_usd as number,
    updated_at: row.updated_at as number,
  }));
}

export async function getOraclePrice(assetId: string): Promise<OraclePriceRecord | null> {
  const client = getDbClient();

  const result = await client.execute({
    sql: "SELECT * FROM oracle_prices WHERE asset_id = ?",
    args: [assetId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    asset_id: row.asset_id as string,
    asset_name: row.asset_name as string,
    price_usd: row.price_usd as number,
    updated_at: row.updated_at as number,
  };
}

export async function upsertOraclePrice(price: OraclePriceRecord): Promise<void> {
  const client = getDbClient();

  await client.execute({
    sql: `INSERT OR REPLACE INTO oracle_prices (asset_id, asset_name, price_usd, updated_at)
          VALUES (?, ?, ?, ?)`,
    args: [price.asset_id, price.asset_name, price.price_usd, price.updated_at],
  });
}

export async function seedOraclePrices(): Promise<void> {
  const defaultPrices: OraclePriceRecord[] = [
    { asset_id: "BTC", asset_name: "Bitcoin", price_usd: 60000, updated_at: Date.now() },
    { asset_id: "ETH", asset_name: "Ethereum", price_usd: 3000, updated_at: Date.now() },
    { asset_id: "SOL", asset_name: "Solana", price_usd: 150, updated_at: Date.now() },
    { asset_id: "ADA", asset_name: "Cardano", price_usd: 0.5, updated_at: Date.now() },
    { asset_id: "LINK", asset_name: "Chainlink", price_usd: 15, updated_at: Date.now() },
    { asset_id: "DOT", asset_name: "Polkadot", price_usd: 7, updated_at: Date.now() },
    { asset_id: "Gold", asset_name: "Gold", price_usd: 4232.20, updated_at: Date.now() },
    { asset_id: "Silver", asset_name: "Silver", price_usd: 56.63, updated_at: Date.now() },
    { asset_id: "AAPL", asset_name: "Apple", price_usd: 277.50, updated_at: Date.now() },
    { asset_id: "MSFT", asset_name: "Microsoft", price_usd: 491.74, updated_at: Date.now() },
    { asset_id: "GOOGL", asset_name: "Alphabet", price_usd: 320.57, updated_at: Date.now() },
    { asset_id: "AMZN", asset_name: "Amazon", price_usd: 230.05, updated_at: Date.now() },
    { asset_id: "NVDA", asset_name: "Nvidia", price_usd: 181.34, updated_at: Date.now() },
    { asset_id: "META", asset_name: "Meta", price_usd: 647.35, updated_at: Date.now() },
    { asset_id: "TSLA", asset_name: "Tesla", price_usd: 426.57, updated_at: Date.now() },
  ];

  for (const price of defaultPrices) {
    await upsertOraclePrice(price);
  }

  console.log("[DB] Oracle prices seeded");
}

// =============================================================================
// VAULT OPERATIONS
// =============================================================================

export async function createVault(vault: Omit<UserVaultRecord, "id">): Promise<UserVaultRecord> {
  const client = getDbClient();

  const result = await client.execute({
    sql: `INSERT INTO user_vaults (owner_address, basket_id, collateral_ada, minted_tokens, tx_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      vault.owner_address,
      vault.basket_id,
      vault.collateral_ada,
      vault.minted_tokens,
      vault.tx_hash || null,
      vault.created_at,
      vault.updated_at,
    ],
  });

  console.log("[DB] Vault created for basket:", vault.basket_id);

  return {
    ...vault,
    id: Number(result.lastInsertRowid),
  };
}

export async function getVaultsByOwner(ownerAddress: string): Promise<UserVaultRecord[]> {
  const client = getDbClient();

  const result = await client.execute({
    sql: "SELECT * FROM user_vaults WHERE owner_address = ? ORDER BY created_at DESC",
    args: [ownerAddress],
  });

  return result.rows.map((row) => ({
    id: row.id as number,
    owner_address: row.owner_address as string,
    basket_id: row.basket_id as string,
    collateral_ada: row.collateral_ada as number,
    minted_tokens: row.minted_tokens as number,
    tx_hash: row.tx_hash as string | undefined,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

export async function updateVault(
  id: number,
  updates: Partial<Pick<UserVaultRecord, "collateral_ada" | "minted_tokens" | "tx_hash">>
): Promise<void> {
  const client = getDbClient();

  const setClauses: string[] = [];
  const args: (string | number)[] = [];

  if (updates.collateral_ada !== undefined) {
    setClauses.push("collateral_ada = ?");
    args.push(updates.collateral_ada);
  }
  if (updates.minted_tokens !== undefined) {
    setClauses.push("minted_tokens = ?");
    args.push(updates.minted_tokens);
  }
  if (updates.tx_hash !== undefined) {
    setClauses.push("tx_hash = ?");
    args.push(updates.tx_hash);
  }

  setClauses.push("updated_at = ?");
  args.push(Date.now());
  args.push(id);

  await client.execute({
    sql: `UPDATE user_vaults SET ${setClauses.join(", ")} WHERE id = ?`,
    args,
  });

  console.log("[DB] Vault updated:", id);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function parseAssetsJson(assetsJson: string): BasketAsset[] {
  try {
    return JSON.parse(assetsJson);
  } catch {
    return [];
  }
}

export function stringifyAssets(assets: BasketAsset[]): string {
  return JSON.stringify(assets);
}

// Calculate basket price from assets and oracle prices
export async function calculateBasketPrice(assets: BasketAsset[]): Promise<number> {
  const prices = await getOraclePrices();
  const priceMap = new Map(prices.map((p) => [p.asset_id, p.price_usd]));

  let totalPrice = 0;
  for (const asset of assets) {
    const price = priceMap.get(asset.id) || 0;
    totalPrice += (price * asset.weight) / 10000; // weight is in basis points
  }

  return totalPrice;
}

