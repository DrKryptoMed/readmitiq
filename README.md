# ReadmitIQ — 30-Day Hospital Readmission Risk Prediction

A production-grade clinical decision support system that predicts a patient's risk of unplanned readmission within 30 days of discharge. ReadmitIQ pairs an explainable gradient-boosted model with a FastAPI inference service and a clinician-facing dashboard, deployed end to end with experiment tracking and a fairness audit.

> **Clinical disclaimer.** ReadmitIQ is a decision-support tool trained on synthetic data. It does not diagnose, does not replace clinical judgement, and has not been validated on a real patient cohort. All predictions must be interpreted alongside a full clinical assessment.

---

## Live demo

| Surface | URL |
|---|---|
| Clinical dashboard | https://readmitiq.vercel.app |
| API (interactive docs) | https://drkryptomed-readmitiq-api.hf.space/docs |
| Experiment tracking | https://dagshub.com/mikailibrahimaremu/readmitiq/experiments |

The API runs on Hugging Face Spaces and the dashboard on Vercel. The dashboard's "Low risk" and "High risk" buttons load example patients so you can see the full prediction range in one click.

---

## Why readmission prediction

Unplanned 30-day readmissions are a major driver of avoidable cost and a recognised marker of care quality. Identifying high-risk patients *at the point of discharge* lets care teams target interventions like medication reconciliation, early follow-up, care-coordinator referral, where they change outcomes. ReadmitIQ produces a calibrated risk score, a plain-language explanation of *why* a patient is flagged, and a concrete recommended action.

---

## Model performance

The production model is an XGBoost classifier, benchmarked against an interpretable logistic-regression baseline. Both were evaluated on a held-out test set that preserves the real class balance (no resampling on test data).

| Metric | Logistic regression | XGBoost (production) |
|---|---|---|
| AUC-ROC | 0.836 | **0.891** |
| Average precision | 0.414 | **0.455** |
| Recall (readmitted class) | 0.69 | **0.77** |
| Brier score | 0.103 | 0.108 |

The 0.75 AUC-ROC line is a common clinical-utility benchmark; the production model clears it comfortably. Recall is prioritised over precision by design because in a readmission-prevention setting, a missed high-risk patient is far costlier than a false alarm that triggers a follow-up call.
See [the model card](backend/MODEL_CARD.md) for full intended-use, fairness, and limitations detail.

### Explainability

Every prediction returns the top SHAP contributors with direction and magnitude, so the output is a clinical narrative rather than a black-box number. Notebook and deployed API produce identical SHAP values, verified to four decimal places.

### Fairness audit (IBM AIF360)

| Group | Disparate impact | Equal opportunity diff | Verdict |
|---|---|---|---|
| Gender (Male vs Female) | 1.094 | 0.024 | PASS |
| Age (≥75 vs <75) | 0.922 | −0.053 | PASS |

No major fairness violations were detected. One borderline signal is the gender average-odds difference of 0.107, marginally above the ±0.10 threshold. This is documented for monitoring rather than ignored.

---

## Data

Trained on [Synthea](https://github.com/synthetichealth/synthea) synthetic patient records (no real PHI). Raw generation: 11,381 patients. After applying CMS-style inpatient inclusion rules and an adult-only filter, the modelling cohort is **3,680 encounters with an 8.7% 30-day readmission rate** (321 positive cases).

### Feature engineering

31 features were engineered across four source tables, every one available at the moment of discharge to avoid target leakage. Feature groups:

- **Prior utilisation** — admissions in prior 6/12 months, ED visits, days since last admission. The strongest predictors, consistent with the published literature.
- **Comorbidity** — Charlson Comorbidity Index (keyword-mapped), active condition count, and disease flags (heart failure, diabetes, COPD, CKD, cancer, MI, and others).
- **Medications** — capped active medication count, polypharmacy flag, and high-risk drug-class flags (anticoagulants, insulin, diuretics, ACE inhibitors).
- **Demographics** — age at admission, gender, income proxy.

All four LACE-index components (Length of stay, Acuity, Comorbidity, ED visits) are represented.

---

## Architecture

```
                         ┌──────────────────────────┐
   Clinician / EHR  ─────▶   Next.js dashboard       │   Vercel
                         │   (risk gauge, SHAP bars) │
                         └────────────┬──────────────┘
                                      │  HTTPS / JSON
                         ┌────────────▼──────────────┐
                         │   FastAPI service          │  Hugging Face
                         │   • Pydantic validation    │  Spaces (Docker)
                         │   • XGBoost inference       │
                         │   • SHAP explainer          │
                         └────────────┬──────────────┘
                                      │
                         ┌────────────▼──────────────┐
                         │   XGBoost model + scaler   │
                         │   (versioned via MLflow)   │  DagsHub
                         └────────────────────────────┘
```

### Tech stack

| Layer | Technology |
|---|---|
| Modelling | Python, scikit-learn, XGBoost, imbalanced-learn (SMOTE) |
| Explainability | SHAP (TreeExplainer) |
| Fairness | IBM AIF360 |
| Experiment tracking | MLflow on DagsHub |
| Serving | FastAPI, Uvicorn, Pydantic |
| Packaging | Docker |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Deployment | Hugging Face Spaces (API), Vercel (dashboard) |

---

## API reference

Base URL: `https://drkryptomed-readmitiq-api.hf.space`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict/features` | Predict from 31 engineered features; returns risk, category, SHAP factors, recommendation |
| `GET` | `/predict/example` | Returns a worked high-risk example patient |
| `GET` | `/health` | Service and model-load status |

Example request:

```bash
curl -X POST https://drkryptomed-readmitiq-api.hf.space/predict/features \
  -H "Content-Type: application/json" \
  -d @patient.json
```

Example response (abridged):

```json
{
  "readmission_risk": 0.841,
  "risk_percent": 84.1,
  "risk_category": "HIGH",
  "top_risk_factors": [
    { "feature": "days_since_last_admission", "impact": 0.65, "direction": "increases" },
    { "feature": "n_medications_capped", "impact": 0.60, "direction": "increases" }
  ],
  "recommendation": "High-risk discharge protocol. Schedule 7-day follow-up ...",
  "model_version": "xgboost_v1_auc0.891"
}
```

Interactive Swagger docs: `/docs`.

---

## Repository structure

```
readmitiq/
├── backend/
│   ├── src/api/
│   │   ├── main.py            FastAPI app, CORS, lifespan model load
│   │   ├── models.py          Pydantic request/response schemas + validation
│   │   ├── predictor.py       Model + scaler + SHAP inference engine
│   │   └── routers/predict.py Prediction endpoints
│   ├── models/                Trained model + scaler (Git LFS)
│   ├── notebooks/             EDA, feature engineering, training
│   ├── reports/figures/       ROC, PR, SHAP, correlation plots
│   ├── Dockerfile             Hugging Face compatible (port 7860)
│   └── requirements*.txt
├── frontend/
│   ├── app/                   Next.js pages
│   ├── components/            Patient form, results panel, risk gauge
│   └── lib/risk-model.ts      API integration layer
├── docker-compose.yml         Full-stack local run
└── README.md
```

---

## Running locally

### Option 1 : Docker (full stack)

```bash
docker-compose up --build
# Dashboard: http://localhost:3000
# API docs:  http://localhost:7860/docs
```

### Option 2: Run services individually

Backend:

```bash
cd backend
conda create -n readmission-env python=3.11 -y
conda activate readmission-env
conda install numpy=1.26.4 setuptools -c conda-forge -y   # avoids Windows pkg_resources issues
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 7860
```

Frontend:

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:7860" > .env.local
npm run dev
```

---

## Reproducing the model

The training notebooks log every run to MLflow on DagsHub. To reproduce:

```bash
cd backend
# configure DagsHub credentials in .env (see .env.example)
jupyter notebook notebooks/03_model_training.ipynb
```

Runs appear at the experiment-tracking URL above, with parameters, metrics, and artifacts versioned per run.

---

## Known limitations

- **Synthetic data.** Trained on Synthea, not real EHR data; absolute risk values and some feature effects (notably the cancer and income signals) reflect simulation artefacts and would need recalibration on real data.
- **Calibration.** XGBoost is slightly less calibrated than the linear baseline; Platt scaling is a planned improvement.
- **Small positive class.** 321 readmissions limit the reliability of subgroup metrics for the smallest strata.
- **Temporal validation.** Production use would require validation on a held-out future time period and prospective monitoring.

---

## Roadmap

- Probability calibration (Platt / isotonic) and a calibration plot in the dashboard
- FHIR input endpoint so an EHR can post a patient bundle directly
- Model card published to the Hugging Face Hub
- Drift monitoring on live inputs

---

## License

MIT. Synthetic data via Synthea (Apache 2.0).

---

*Built by Ibrahim A. Mikail- Healthcare AI/ML Engineer.*
