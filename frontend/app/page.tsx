"use client"

import { useState } from "react"
import {
  calculateRisk,
  DEFAULT_INPUT,
  type PatientInput,
  type RiskResult,
} from "@/lib/risk-model"
import { PatientForm } from "@/components/patient-form"
import { ResultsPanel } from "@/components/results-panel"
import { HeartPulse } from "lucide-react"

const MODEL_VERSION = "xgboost_v1_auc0.891"

export default function Page() {
  const [input, setInput]   = useState<PatientInput>(DEFAULT_INPUT)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleCalculate = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await calculateRisk(input)
      setResult(res)
    } catch (err) {
      setError(
        "Could not reach the prediction API. " +
        "Make sure the FastAPI server is running on port 8000."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-foreground">
                ReadmitIQ
              </h1>
              <p className="text-xs text-muted-foreground">
                30-Day Readmission Risk Decision Support
              </p>
            </div>
          </div>
          <span className="hidden rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground sm:inline">
            Clinical Use
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">

          {/* Left: form */}
          <section
            aria-label="Patient data entry"
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                Patient Data Entry
              </h2>
              <p className="text-sm text-muted-foreground">
                Complete the fields below to estimate readmission risk.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <PatientForm
              value={input}
              onChange={setInput}
              onSubmit={handleCalculate}
              loading={loading}
            />
          </section>

          {/* Right: results */}
          <section
            aria-label="Risk results"
            className="lg:sticky lg:top-20 lg:self-start rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <ResultsPanel
              result={result}
              modelVersion={MODEL_VERSION}
              loading={loading}
            />
          </section>

        </div>
      </main>
    </div>
  )
}