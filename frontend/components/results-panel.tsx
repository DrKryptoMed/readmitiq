"use client"

import type { RiskResult } from "@/lib/risk-model"
import { RiskGauge, RiskGaugeAccessibleLabel } from "@/components/risk-gauge"
import { cn } from "@/lib/utils"
import { Activity, ArrowDownRight, ArrowUpRight, ClipboardList, Info, Loader2 } from "lucide-react"

interface ResultsPanelProps {
  result: RiskResult | null
  modelVersion: string
  loading?: boolean
}

const CATEGORY_STYLES = {
  LOW:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  HIGH:   "bg-red-500/15 text-red-300 border-red-500/30",
} as const

const RECO_STYLES = {
  LOW:    "border-emerald-500/30 bg-emerald-500/5",
  MEDIUM: "border-amber-500/30 bg-amber-500/5",
  HIGH:   "border-red-500/30 bg-red-500/5",
} as const

export function ResultsPanel({ result, modelVersion, loading }: ResultsPanelProps) {
  if (loading) {
    return <LoadingState modelVersion={modelVersion} />
  }

  if (!result) {
    return <EmptyState modelVersion={modelVersion} />
  }

  const maxImpact = Math.max(...result.factors.map((f) => Math.abs(f.impact)), 0.0001)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Risk Assessment</h2>
        <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          {modelVersion}
        </span>
      </header>

      {/* Gauge + category */}
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-secondary/20 p-6">
        <RiskGauge percent={result.percent} category={result.category} />
        <RiskGaugeAccessibleLabel percent={result.percent} category={result.category} />
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide",
            CATEGORY_STYLES[result.category],
          )}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {result.category} RISK
        </div>
      </div>

      {/* Top risk factors */}
      <section className="rounded-xl border border-border bg-secondary/20 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Top Risk Factors</h3>
        </div>
        <ul className="flex flex-col gap-3">
          {result.factors.map((f) => {
            const up = f.direction === "up"
            const width = `${Math.max(8, (Math.abs(f.impact) / maxImpact) * 100)}%`
            return (
              <li key={f.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    {up ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-sky-400" />
                    )}
                    {f.label}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      up ? "text-red-400" : "text-sky-400",
                    )}
                  >
                    {up ? "+" : ""}
                    {f.impact.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", up ? "bg-red-500/80" : "bg-sky-500/80")}
                    style={{ width }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/80" /> Increases risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500/80" /> Decreases risk
          </span>
        </p>
      </section>

      {/* Recommendation */}
      <section
        className={cn(
          "flex gap-3 rounded-xl border p-5",
          RECO_STYLES[result.category],
        )}
      >
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-foreground/80" />
        <div>
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Clinical Recommendation
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.recommendation}
          </p>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}

function LoadingState({ modelVersion }: { modelVersion: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Risk Assessment</h2>
        <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          {modelVersion}
        </span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-secondary/10 p-12 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Calculating risk...</p>
          <p className="text-sm text-muted-foreground">
            Running XGBoost inference and SHAP explainability
          </p>
        </div>
      </div>
      <Disclaimer />
    </div>
  )
}

function EmptyState({ modelVersion }: { modelVersion: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Risk Assessment</h2>
        <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          {modelVersion}
        </span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-secondary/10 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
          <Activity className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">No assessment yet</p>
          <p className="max-w-xs text-pretty text-sm text-muted-foreground">
            Enter the patient&apos;s admission details and click{" "}
            <span className="font-medium text-foreground">Calculate Risk</span> to
            generate a 30-day readmission risk estimate.
          </p>
        </div>
      </div>
      <Disclaimer />
    </div>
  )
}

function Disclaimer() {
  return (
    <p className="flex gap-2 text-pretty text-[11px] leading-relaxed text-muted-foreground/70">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        For clinical decision support only. This tool provides a statistical
        risk estimate and does not constitute a diagnosis or a substitute for
        professional clinical judgment. Predictions are generated by an XGBoost
        model (AUC 0.891) trained on synthetic clinical data. Always corroborate
        with a full clinical evaluation.
      </span>
    </p>
  )
}