import { cn } from "@/lib/utils"

interface RiskGaugeProps {
  /** 0 - 100 */
  percent: number
  category: "LOW" | "MEDIUM" | "HIGH"
}

const COLORS = {
  LOW: "oklch(0.72 0.15 155)",
  MEDIUM: "oklch(0.78 0.15 75)",
  HIGH: "oklch(0.63 0.21 25)",
} as const

export function RiskGauge({ percent, category }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const color = COLORS[category]
  // Conic gradient sweep for the ring
  const ringStyle = {
    background: `conic-gradient(${color} ${clamped * 3.6}deg, oklch(0.27 0.02 240) 0deg)`,
  }

  return (
    <div className="relative mx-auto aspect-square w-52 sm:w-60" aria-hidden="true">
      <div className="h-full w-full rounded-full" style={ringStyle} />
      {/* Inner cutout */}
      <div className="absolute inset-[14%] flex flex-col items-center justify-center rounded-full bg-card">
        <span
          className="font-mono text-5xl font-semibold tabular-nums tracking-tight"
          style={{ color }}
        >
          {clamped.toFixed(1)}
          <span className="text-2xl">%</span>
        </span>
        <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
          30-day risk
        </span>
      </div>
      {/* Tick marks at the 20% and 50% thresholds */}
      <Tick angle={20 * 3.6} />
      <Tick angle={50 * 3.6} />
    </div>
  )
}

function Tick({ angle }: { angle: number }) {
  return (
    <span
      className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <span className="block h-[14%] w-[2px] -translate-x-1/2 rounded bg-background/80" />
    </span>
  )
}

export function RiskGaugeAccessibleLabel({
  percent,
  category,
}: RiskGaugeProps) {
  return (
    <span className={cn("sr-only")}>
      Predicted 30-day readmission risk is {percent.toFixed(1)} percent,
      categorized as {category} risk.
    </span>
  )
}
