// Trade Page - UI Only (Demo)

"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@/components/connection/context";
import { useDatabase } from "@/components/database/DatabaseProvider";
import { Button, Card, CardTitle, Input, Select } from "@/components/ui";
import { Tabs, TabsList, Tab, TabPanel } from "@/components/ui";

// Mock historical data for the chart
const generateMockData = (basePrice: number) => {
  const data: { time: string; price: number }[] = [];
  let price = basePrice * 0.9;
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    price = price * (1 + (Math.random() - 0.48) * 0.05);
    data.push({
      time: date.toISOString().split("T")[0],
      price: Math.round(price * 100) / 100,
    });
  }
  return data;
};

// Mock order history
const MOCK_ORDERS = [
  { date: "2023-10-27 14:30", basket: "eBASKET-TECH", type: "Buy", amount: "10.5", price: "$170.15" },
  { date: "2023-10-26 09:15", basket: "eBASKET-FIN", type: "Sell", amount: "5.0", price: "$210.45" },
  { date: "2023-10-25 11:00", basket: "eBASKET-HEALTH", type: "Buy", amount: "2.1", price: "$135.20" },
  { date: "2023-10-24 16:45", basket: "eBASKET-TECH", type: "Sell", amount: "20.0", price: "$172.50" },
  { date: "2023-10-23 10:05", basket: "eBASKET-ENERGY", type: "Buy", amount: "15.0", price: "$330.60" },
];

export function TradePage() {
  const [connection] = useWallet();
  const { baskets, oraclePrices, isLoading } = useDatabase();
  
  const [selectedBasketId, setSelectedBasketId] = useState<string>("");
  const [timeRange, setTimeRange] = useState("1D");
  const [searchQuery, setSearchQuery] = useState("");

  // Buy/Sell form state
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");

  // Get ADA price
  const adaPrice = oraclePrices.find((p) => p.assetId === "ADA")?.priceUsd || 0.5;

  // Get selected basket
  const selectedBasket = useMemo(() => {
    if (!selectedBasketId && baskets.length > 0) {
      return baskets[0];
    }
    return baskets.find((b) => b.basketId === selectedBasketId);
  }, [baskets, selectedBasketId]);

  // Set default basket
  useMemo(() => {
    if (!selectedBasketId && baskets.length > 0) {
      setSelectedBasketId(baskets[0].basketId);
    }
  }, [baskets, selectedBasketId]);

  const basketPrice = selectedBasket?.price || 0;

  // Generate chart data
  const chartData = generateMockData(basketPrice || 100);
  const currentPrice = chartData[chartData.length - 1].price;
  const previousPrice = chartData[chartData.length - 2].price;
  const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

  // SVG Line Chart
  const chartWidth = 600;
  const chartHeight = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const minPrice = Math.min(...chartData.map((d) => d.price)) * 0.98;
  const maxPrice = Math.max(...chartData.map((d) => d.price)) * 1.02;

  const xScale = (i: number) => padding.left + (i / (chartData.length - 1)) * innerWidth;
  const yScale = (price: number) =>
    padding.top + innerHeight - ((price - minPrice) / (maxPrice - minPrice)) * innerHeight;

  const linePath = chartData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.price)}`)
    .join(" ");

  const filteredOrders = MOCK_ORDERS.filter(
    (order) =>
      order.basket.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.date.includes(searchQuery)
  );

  const basketOptions = baskets.map((b) => ({
    value: b.basketId,
    label: b.name,
  }));

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Loading baskets...</p>
      </div>
    );
  }

  if (baskets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">No Baskets to Trade</h2>
        <p className="text-slate-400 mb-6">Create a basket first to start trading.</p>
        <a href="/create">
          <Button>Create Basket</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Select
              options={basketOptions}
              value={selectedBasketId}
              onChange={(e) => setSelectedBasketId(e.target.value)}
              placeholder="Select basket"
            />
          </div>
          <div>
            <div className="text-sm text-slate-400">{selectedBasket?.name || "Select a basket"}</div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-white">
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span
                className={`text-sm font-medium ${
                  priceChange >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {["1H", "4H", "1D", "1W", "1M"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <Card padding="sm">
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto min-w-[400px]"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = padding.top + innerHeight * (1 - pct);
                  const price = minPrice + (maxPrice - minPrice) * pct;
                  return (
                    <g key={pct}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#374151"
                        strokeDasharray="4"
                      />
                      <text
                        x={padding.left - 8}
                        y={y}
                        textAnchor="end"
                        alignmentBaseline="middle"
                        fill="#6B7280"
                        fontSize="10"
                      >
                        ${price.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Area fill */}
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${linePath} L ${xScale(chartData.length - 1)} ${
                    padding.top + innerHeight
                  } L ${padding.left} ${padding.top + innerHeight} Z`}
                  fill="url(#areaGradient)"
                />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                />

                {/* Current price dot */}
                <circle
                  cx={xScale(chartData.length - 1)}
                  cy={yScale(currentPrice)}
                  r="4"
                  fill="#3B82F6"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Basket composition */}
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
        </div>

        {/* Trade Panel */}
        <div>
          <Card>
            <Tabs defaultValue="buy">
              <TabsList className="w-full">
                <Tab value="buy">Buy</Tab>
                <Tab value="sell">Sell</Tab>
              </TabsList>

              <TabPanel value="buy">
                <div className="space-y-4">
                  <Input
                    label="Amount to spend"
                    type="number"
                    placeholder="0.00"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    suffix="ADA"
                  />
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Available:</span>
                    <span>Connect wallet to see balance</span>
                  </div>

                  <Input
                    label="Estimated to receive"
                    type="text"
                    placeholder="0.00"
                    value={
                      buyAmount && currentPrice
                        ? (
                            (parseFloat(buyAmount) * adaPrice) /
                            currentPrice
                          ).toFixed(4)
                        : ""
                    }
                    disabled
                    suffix={selectedBasket?.name?.split(" ")[0] || "tokens"}
                  />

                  <Button fullWidth disabled={!connection}>
                    {connection ? "Buy eBasket" : "Connect Wallet to Trade"}
                  </Button>

                  {!connection && (
                    <p className="text-xs text-center text-slate-500">
                      Connect wallet to trade
                    </p>
                  )}

                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">
                    ⚠️ Trading is a demo feature. In production, this would integrate with a DEX.
                  </div>
                </div>
              </TabPanel>

              <TabPanel value="sell">
                <div className="space-y-4">
                  <Input
                    label="Amount to sell"
                    type="number"
                    placeholder="0.00"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    suffix="tokens"
                  />
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Available:</span>
                    <span>0 tokens</span>
                  </div>

                  <Input
                    label="Estimated to receive"
                    type="text"
                    placeholder="0.00"
                    value={
                      sellAmount && currentPrice
                        ? (
                            parseFloat(sellAmount) *
                            currentPrice /
                            adaPrice
                          ).toFixed(2)
                        : ""
                    }
                    disabled
                    suffix="ADA"
                  />

                  <Button fullWidth variant="danger" disabled={!connection}>
                    {connection ? "Sell eBasket" : "Connect Wallet to Trade"}
                  </Button>

                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">
                    ⚠️ Trading is a demo feature. In production, this would integrate with a DEX.
                  </div>
                </div>
              </TabPanel>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Order History */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Order History (Demo)</CardTitle>
          <div className="relative w-64">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
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
              placeholder="Search basket or date"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Basket
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-slate-500"
                    >
                      No orders found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-slate-400">
                        {order.date}
                      </td>
                      <td className="py-3 px-4 text-sm text-white font-medium">
                        {order.basket}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-sm font-medium ${
                            order.type === "Buy"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {order.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-white">
                        {order.amount} {order.basket}
                      </td>
                      <td className="py-3 px-4 text-sm text-white text-right">
                        {order.price}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default TradePage;
