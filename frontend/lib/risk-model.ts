export type Gender = "male" | "female"

export interface PatientInput {
  // Admission details
  lengthOfStay: number
  admissionMonth: number
  emergencyAdmission: boolean
  // Prior history
  priorAdmissions6m: number
  edVisits6m: number
  daysSinceLastAdmission: number
  // Comorbidities
  heartFailure: boolean
  diabetes: boolean
  copd: boolean
  ckd: boolean
  cancer: boolean
  priorMI: boolean
  // Medications
  medicationCount: number
  anticoagulant: boolean
  insulin: boolean
  diuretic: boolean
  aceInhibitor: boolean
  // Demographics
  age: number
  gender: Gender
  annualIncome: number
  charlsonScore: number
  activeConditions: number
}

export interface RiskFactor {
  label: string
  /** signed contribution to the risk score (logit space) */
  impact: number
  /** "up" increases risk, "down" decreases risk */
  direction: "up" | "down"
}

export type RiskCategory = "LOW" | "MEDIUM" | "HIGH"

export interface RiskResult {
  /** 0 - 100 */
  percent: number
  category: RiskCategory
  factors: RiskFactor[]
  recommendation: string
}

export const DEFAULT_INPUT: PatientInput = {
  lengthOfStay: 4,
  admissionMonth: new Date().getMonth() + 1,
  emergencyAdmission: false,
  priorAdmissions6m: 0,
  edVisits6m: 0,
  daysSinceLastAdmission: 180,
  heartFailure: false,
  diabetes: false,
  copd: false,
  ckd: false,
  cancer: false,
  priorMI: false,
  medicationCount: 5,
  anticoagulant: false,
  insulin: false,
  diuretic: false,
  aceInhibitor: false,
  age: 65,
  gender: "male",
  annualIncome: 45000,
  charlsonScore: 2,
  activeConditions: 3,
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/**
 * Transparent logistic-style scoring model. Coefficients are illustrative
 * and calibrated to produce clinically plausible relative risk ordering —
 * they are NOT derived from a validated patient cohort.
 */
export async function calculateRisk(input: PatientInput): Promise<RiskResult> {
  const los = input.lengthOfStay
  const medcount = input.medicationCount
  const prior6m = input.priorAdmissions6m

  const payload = {
    los_days: los,
    los_days_log: Math.log1p(los),
    admission_month: input.admissionMonth,
    admission_dow: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1,
    is_emergency: input.emergencyAdmission ? 1 : 0,
    n_admissions_prior_6m: prior6m,
    n_admissions_prior_12m: Math.min(prior6m * 2, 100),
    n_ed_visits_prior_6m: input.edVisits6m,
    days_since_last_admission: input.daysSinceLastAdmission || 999,
    has_prior_admission: prior6m > 0 ? 1 : 0,
    charlson_score: input.charlsonScore,
    n_active_conditions: input.activeConditions,
    has_heart_failure: input.heartFailure ? 1 : 0,
    has_diabetes: input.diabetes ? 1 : 0,
    has_diabetes_complex: 0,
    has_copd: input.copd ? 1 : 0,
    has_ckd: input.ckd ? 1 : 0,
    has_mi: input.priorMI ? 1 : 0,
    has_cancer: input.cancer ? 1 : 0,
    has_dementia: 0,
    has_cerebrovascular: 0,
    has_pvd: 0,
    n_medications_capped: Math.min(medcount, 520),
    is_high_polypharmacy: medcount > 10 ? 1 : 0,
    has_insulin: input.insulin ? 1 : 0,
    has_anticoagulant: input.anticoagulant ? 1 : 0,
    has_diuretic: input.diuretic ? 1 : 0,
    has_ace_inhibitor: input.aceInhibitor ? 1 : 0,
    age_at_admission: input.age,
    gender_male: input.gender === 'male' ? 1 : 0,
    income: input.annualIncome,
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const response = await fetch(`${API_URL}/predict/features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()

  // Map API response to RiskResult shape
  const factors: RiskFactor[] = data.top_risk_factors.map((f: any) => ({
    label: f.description,
    impact: f.impact,
    direction: f.direction === 'increases' ? 'up' : 'down',
  }))

  return {
    percent: data.risk_percent,
    category: data.risk_category as RiskCategory,
    factors,
    recommendation: data.recommendation,
  }
}

function buildRecommendation(category: RiskCategory, factors: RiskFactor[]): string {
  const top = factors[0]?.label.toLowerCase()
  switch (category) {
    case "HIGH":
      return `High readmission risk. Initiate intensive transitional care: schedule a follow-up appointment within 7 days, arrange a pharmacist medication reconciliation, and consider home-health or care-management enrollment${
        top ? ` with attention to ${top}` : ""
      }.`
    case "MEDIUM":
      return `Moderate readmission risk. Provide structured discharge education, confirm a follow-up visit within 14 days, and perform a 48-72 hour post-discharge phone check-in${
        top ? `, prioritizing ${top}` : ""
      }.`
    default:
      return "Low readmission risk. Standard discharge planning and routine follow-up are appropriate. Reinforce warning signs and ensure the patient has a primary care contact."
  }
}
