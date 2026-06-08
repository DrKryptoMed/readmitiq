"""
Prediction endpoints.

Thin router layer — HTTP handling only.
All business logic lives in predictor.py.

Endpoints:
    POST /predict/features  — predict from engineered features
    GET  /predict/example   — return example high-risk patient
"""

import logging
from fastapi import APIRouter, HTTPException, status

from src.api.models import PatientFeatures, PredictionResponse
from src.api.predictor import predictor

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/predict",
    tags=["Prediction"],
)


@router.post(
    "/features",
    response_model=PredictionResponse,
    summary="Predict 30-day readmission risk",
    description="""
    Accepts 31 engineered clinical features and returns:
    - Readmission probability (0.0–1.0)
    - Risk category (LOW / MEDIUM / HIGH)
    - Top 5 SHAP-based risk factors with clinical descriptions
    - Clinical action recommendation

    All features must be computed at the point of patient discharge.
    Features requiring post-discharge knowledge constitute target leakage
    and must not be included.
    """,
    status_code=status.HTTP_200_OK,
)
async def predict_from_features(
    patient: PatientFeatures,
) -> PredictionResponse:
    """
    Run readmission risk prediction for a single patient.

    The request body should contain all 31 engineered features.
    See the /predict/example endpoint for a sample high-risk patient.
    """
    if not predictor.is_loaded:
        logger.error("Prediction requested but model not loaded")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Model not available",
                "message": "The prediction model is not loaded. "
                           "Please try again in a few seconds.",
            }
        )

    try:
        logger.info(
            f"Prediction request received — "
            f"age={patient.age_at_admission}, "
            f"los={patient.los_days}, "
            f"charlson={patient.charlson_score}"
        )

        result = predictor.predict(patient)

        logger.info(
            f"Prediction complete — "
            f"risk={result.risk_percent}%, "
            f"category={result.risk_category}"
        )

        return result

    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Prediction failed",
                "message": "An error occurred during prediction. "
                           "Please check your input and try again.",
            }
        )


@router.get(
    "/example",
    response_model=dict,
    summary="Get example patient input",
    description="Returns the highest-risk patient from model evaluation "
                "as an example API input. Useful for testing.",
)
async def get_example_patient() -> dict:
    """
    Return example high-risk patient features.

    This is the patient from the SHAP waterfall plot —
    predicted 99.6% readmission risk, actually readmitted.
    """
    return {
        "description": "Highest-risk patient from model evaluation",
        "predicted_risk": "99.6%",
        "actual_outcome": "Readmitted",
        "clinical_profile": (
            "Male, age 66.6, 3 prior admissions in 6 months, "
            "47 medications, Charlson score 2, 29 active conditions"
        ),
        "features": {
            "los_days": 6.0,
            "los_days_log": 1.946,
            "admission_month": 2,
            "admission_dow": 1,
            "is_emergency": 0,
            "n_admissions_prior_6m": 3,
            "n_admissions_prior_12m": 3,
            "n_ed_visits_prior_6m": 1,
            "days_since_last_admission": 28.0,
            "has_prior_admission": 1,
            "charlson_score": 2,
            "n_active_conditions": 29,
            "has_heart_failure": 0,
            "has_diabetes": 0,
            "has_diabetes_complex": 0,
            "has_copd": 0,
            "has_ckd": 1,
            "has_mi": 0,
            "has_cancer": 1,
            "has_dementia": 0,
            "has_cerebrovascular": 0,
            "has_pvd": 0,
            "n_medications_capped": 47.0,
            "is_high_polypharmacy": 1,
            "has_insulin": 0,
            "has_anticoagulant": 1,
            "has_diuretic": 1,
            "has_ace_inhibitor": 0,
            "age_at_admission": 66.6,
            "gender_male": 1,
            "income": 125393.0
        }
    }