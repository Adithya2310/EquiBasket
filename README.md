# **EquiBaskets — On-Chain Tokenized Baskets on Cardano (Aiken + ADA + Mock Oracle)**

## 📌 Overview

EquiBaskets is a lightweight Cardano-based protocol that lets users mint and trade **tokenized baskets of multiple assets**.
Instead of tracking a single stock or index, each basket represents a **weighted collection of assets**, and its price is calculated by a **mock oracle module** that aggregates hardcoded prices.

This project is intentionally designed to be **simple, modular, and easy to build inside Cursor**, even if you're coming from the EVM world.

---

## 🎯 What You Can Do With EquiBaskets

### ✅ **Create a Basket (Fund Creator Role)**

A fund creator defines:

* The list of assets inside the basket
* Their weights
* The basket’s ID and metadata

Once created, the basket becomes available for minting and trading.

---

### ✅ **Mint Basket Tokens**

Users deposit **ADA as collateral** to mint the basket token.
Minting uses:

* The latest basket price from the mock oracle
* A predefined collateral ratio
* Simple minting rules enforced by Aiken contracts

This mechanism ensures each minted basket token is fully backed by ADA.

---

### ✅ **Burn Basket Tokens**

Users can burn their basket tokens to withdraw the corresponding amount of ADA based on the current basket price.

---

### ✅ **Check Basket Prices**

The **mock oracle module** provides a dynamic basket price on demand.
It contains:

* Hardcoded prices for individual assets
* A price aggregation function
* A simple interface the smart contract can read

This removes complexity while still simulating a real-world multi-asset oracle.

---

### ✅ **Basic Liquidation**

If a position falls below a threshold, another user can liquidate it by repaying the debt and receiving the user's collateral at a small discount.
(Logic is included conceptually; Cursor will generate the implementation.)

---

## 🧱 Architecture

### **1. Smart Contracts (Aiken)**

You will build the following modules in Cursor:

#### **📦 Basket Factory**

* Registers new baskets
* Stores metadata (assets, weights, precision)
* Ensures each basket has a unique ID

#### **💰 Vault**

* Users deposit ADA
* Mints and burns basket tokens
* Tracks collateral and debt per user
* Reads basket price from the oracle
* Enforces collateral ratio rules
* Handles liquidation

#### **🪙 Minting Policy**

* Controls who can mint/burn basket tokens
* Ensures only the Vault can perform minting
* Ensures correct spending conditions

#### **🔮 Mock Oracle**

* Stores hardcoded prices for several assets
* Computes basket price based on weights
* Returns result in standardized decimals
* No external calls → super easy for Cardano beginners

---

### **2. Frontend (React / TypeScript)**

Cursor will scaffold a clean UI that includes:

* **Basket Creation Page**
  Enter assets, weights, and publish a new basket.

* **Mint / Burn Page**
  Deposit ADA to mint tokens or burn tokens to withdraw ADA.

* **Price Dashboard**
  View basket price computed using mock oracle.

* **Portfolio Page**
  Track user collateral, basket holdings, and debt.

---

### **3. Off-Chain Logic (Minimal)**

Because Cardano uses the eUTXO model, the off-chain components help prepare transactions:

* Selecting UTXOs
* Reading basket definitions
* Reading the latest mock price
* Setting transaction redeemers
* Interacting with minting policies

No need for complex bots or external oracles.

---

## 📐 Data Flow

1. Fund Creator registers a basket → Factory stores it
2. Oracle module returns basket price (hardcoded)
3. User deposits ADA → Vault stores collateral
4. User mints basket tokens → Minting policy validates
5. User can burn tokens → Vault releases ADA
6. Liquidation can be triggered when collateral ratio becomes unsafe

---

## 🧪 What You Can Test Easily

* Create a basket with 3 assets
* Change oracle prices by editing a constant
* Mint/burn flows using ADA
* Liquidation triggers
* Reading price + metadata from UI