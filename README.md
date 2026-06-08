# ReadmitIQ — 30-Day Hospital Readmission Risk System

A production-grade clinical AI system that predicts 30-day hospital 
readmission risk at the point of patient discharge.

## Live Demo
- **Dashboard:** https://readmitiq.vercel.app *(coming soon)*
- **API docs:** https://drkryptomed-readmitiq-api.hf.space/docs *(coming soon)*

## Model Performance
| Metric | Value |
|--------|-------|
| AUC-ROC | **0.891** |
| Recall | **77%** |
| Fairness | IBM AIF360 — PASS |

## Quick Start
```bash
docker-compose up --build
```

## Stack
- Backend: FastAPI + XGBoost → HuggingFace Spaces
- Frontend: Next.js → Vercel
- Tracking: MLflow → DagsHub
