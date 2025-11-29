// Lightweight SVG Pie Chart Component

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  innerRadius?: number;
  showLabels?: boolean;
  centerText?: string;
  centerSubtext?: string;
}

export function PieChart({
  data,
  size = 200,
  innerRadius = 60,
  centerText,
  centerSubtext,
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  const center = size / 2;

  // Calculate paths for each segment
  let currentAngle = -90; // Start from top

  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculate SVG arc path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const ix1 = center + innerRadius * Math.cos(startRad);
    const iy1 = center + innerRadius * Math.sin(startRad);
    const ix2 = center + innerRadius * Math.cos(endRad);
    const iy2 = center + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = [
      `M ${ix1} ${iy1}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    return {
      ...item,
      path,
      percentage,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.path}
            fill={segment.color}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}

        {/* Center text */}
        {(centerText || centerSubtext) && (
          <>
            {centerText && (
              <text
                x={center}
                y={center - (centerSubtext ? 8 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white text-2xl font-bold"
              >
                {centerText}
              </text>
            )}
            {centerSubtext && (
              <text
                x={center}
                y={center + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-400 text-xs"
              >
                {centerSubtext}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-2 w-full">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-slate-300">{segment.label}</span>
            </div>
            <span className="text-white font-medium">
              {segment.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PieChart;

