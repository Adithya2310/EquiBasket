// Collateral Ratio Progress Bar Component

interface CollateralRatioBarProps {
  ratio: number; // Percentage (e.g., 176.47 for 176.47%)
  threshold?: number; // Default 150%
  className?: string;
}

export function CollateralRatioBar({
  ratio,
  threshold = 150,
  className = "",
}: CollateralRatioBarProps) {
  // Calculate the position and color based on ratio
  const isHealthy = ratio >= threshold;
  const maxDisplay = Math.max(200, ratio + 20); // Dynamic max for display
  const percentage = Math.min((ratio / maxDisplay) * 100, 100);
  const thresholdPosition = (threshold / maxDisplay) * 100;

  const getColor = () => {
    if (ratio >= threshold * 1.5) return "bg-green-500";
    if (ratio >= threshold) return "bg-green-500";
    if (ratio >= threshold * 0.8) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Current C-Ratio</span>
        <span
          className={`text-lg font-bold ${
            isHealthy ? "text-green-400" : "text-red-400"
          }`}
        >
          {ratio === Infinity ? "∞" : `${ratio.toFixed(2)}%`}
        </span>
      </div>

      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        {/* Progress bar */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />

        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/50"
          style={{ left: `${thresholdPosition}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>0%</span>
        <span className="text-yellow-400">150% Liquidation</span>
        <span>{maxDisplay}%</span>
      </div>
    </div>
  );
}

export default CollateralRatioBar;

