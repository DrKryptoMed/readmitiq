"use client"

import type { PatientInput, Gender } from "@/lib/risk-model"
import { cn } from "@/lib/utils"

interface PatientFormProps {
  value: PatientInput
  onChange: (next: PatientInput) => void
  onSubmit: () => void
  loading?: boolean
}

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
]

export function PatientForm({ value, onChange, onSubmit, loading }: PatientFormProps) {
  const set = <K extends keyof PatientInput>(key: K, v: PatientInput[K]) =>
    onChange({ ...value, [key]: v })

  const highPolypharmacy = value.medicationCount > 10

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-6"
    >
      {/* Admission Details */}
      <Section title="Admission Details">
        <NumberField
          label="Length of stay (days)"
          min={1}
          value={value.lengthOfStay}
          onChange={(v) => set("lengthOfStay", v)}
        />
        <div className="flex flex-col gap-1.5">
          <Label>Admission month</Label>
          <select
            value={value.admissionMonth}
            onChange={(e) => set("admissionMonth", Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1} className="bg-card">
                {m}
              </option>
            ))}
          </select>
        </div>
        <Toggle
          label="Emergency admission"
          value={value.emergencyAdmission}
          onChange={(v) => set("emergencyAdmission", v)}
          options={["No", "Yes"]}
        />
      </Section>

      {/* Prior History */}
      <Section title="Prior History">
        <NumberField
          label="Admissions in past 6 months"
          min={0}
          value={value.priorAdmissions6m}
          onChange={(v) => set("priorAdmissions6m", v)}
        />
        <NumberField
          label="ED visits in past 6 months"
          min={0}
          value={value.edVisits6m}
          onChange={(v) => set("edVisits6m", v)}
        />
        <NumberField
          label="Days since last admission"
          min={0}
          value={value.daysSinceLastAdmission}
          onChange={(v) => set("daysSinceLastAdmission", v)}
        />
      </Section>

      {/* Comorbidities */}
      <Section title="Comorbidities">
        <div className="col-span-full grid grid-cols-2 gap-2">
          <Check label="Heart Failure" value={value.heartFailure} onChange={(v) => set("heartFailure", v)} />
          <Check label="Diabetes" value={value.diabetes} onChange={(v) => set("diabetes", v)} />
          <Check label="COPD" value={value.copd} onChange={(v) => set("copd", v)} />
          <Check label="Chronic Kidney Disease" value={value.ckd} onChange={(v) => set("ckd", v)} />
          <Check label="Cancer" value={value.cancer} onChange={(v) => set("cancer", v)} />
          <Check label="Prior MI" value={value.priorMI} onChange={(v) => set("priorMI", v)} />
        </div>
      </Section>

      {/* Medications */}
      <Section title="Medications">
        <NumberField
          label="Medication count"
          min={0}
          value={value.medicationCount}
          onChange={(v) => set("medicationCount", v)}
        />
        <div className="flex flex-col gap-1.5">
          <Label>Polypharmacy (&gt;10 meds)</Label>
          <div
            className={cn(
              "flex h-10 items-center justify-between rounded-md border px-3 text-sm",
              highPolypharmacy
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-input bg-secondary/40 text-muted-foreground",
            )}
          >
            <span>{highPolypharmacy ? "Yes — flagged" : "No"}</span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                highPolypharmacy ? "bg-amber-400" : "bg-muted-foreground/40",
              )}
            />
          </div>
        </div>
        <div className="col-span-full grid grid-cols-2 gap-2">
          <Check label="Anticoagulant" value={value.anticoagulant} onChange={(v) => set("anticoagulant", v)} />
          <Check label="Insulin" value={value.insulin} onChange={(v) => set("insulin", v)} />
          <Check label="Diuretic" value={value.diuretic} onChange={(v) => set("diuretic", v)} />
          <Check label="ACE Inhibitor" value={value.aceInhibitor} onChange={(v) => set("aceInhibitor", v)} />
        </div>
      </Section>

      {/* Demographics */}
      <Section title="Demographics">
        <NumberField label="Age at admission" min={18} value={value.age} onChange={(v) => set("age", v)} />
        <Toggle
          label="Gender"
          value={value.gender === "female"}
          onChange={(v) => set("gender", (v ? "female" : "male") as Gender)}
          options={["Male", "Female"]}
        />
        <NumberField
          label="Annual income ($)"
          min={0}
          step={1000}
          value={value.annualIncome}
          onChange={(v) => set("annualIncome", v)}
        />
        <NumberField
          label="Charlson score"
          min={0}
          max={15}
          value={value.charlsonScore}
          onChange={(v) => set("charlsonScore", v)}
        />
        <NumberField
          label="Active conditions count"
          min={0}
          value={value.activeConditions}
          onChange={(v) => set("activeConditions", v)}
        />
      </Section>

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "sticky bottom-0 mt-2 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card",
          loading
            ? "opacity-60 cursor-not-allowed"
            : "hover:bg-primary/90"
        )}
      >
        {loading ? "Calculating..." : "Calculate Risk"}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border bg-secondary/20 p-4">
      <legend className="px-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
        {title}
      </legend>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-muted-foreground">{children}</label>
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          onChange(Number.isNaN(n) ? (min ?? 0) : n)
        }}
        className="h-10 rounded-md border border-input bg-secondary/40 px-3 text-sm tabular-nums text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  options: [string, string]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 rounded-md border border-input bg-secondary/40 p-0.5">
        {options.map((opt, i) => {
          const active = (i === 1) === value
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(i === 1)}
              className={cn(
                "h-9 rounded text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Check({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
        value
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-input bg-secondary/40 text-muted-foreground hover:border-border hover:text-foreground",
      )}
      aria-pressed={value}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          value ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
        )}
      >
        {value && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
            <path d="M2.5 6.2l2.2 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}