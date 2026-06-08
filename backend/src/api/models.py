"""
Pydantic schemas for request and response validation.

Every field that enters or leaves the API is defined here.
Pydantic validates types, ranges, and required fields automatically.
FastAPI returns a 422 error with clear messages if validation fails.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum


class RiskCategory(str, Enum):
    """
    Clinical risk categories with intervention thresholds.
    Thresholds based on clinical literature and LACE index mapping.
    """
    LOW    = "LOW"
    MEDIUM = "MEDIUM"
    HIGH   = "HIGH"


class PatientFeatures(BaseModel):
    """
    Input schema — 31 engineered features for readmission prediction.
    All features must be available at the point of patient discharge.
    
    Field descriptions explain the clinical meaning of each input.
    Min/max constraints catch impossible or clearly erroneous values.
    """

    # --- Encounter features ---
    los_days: float = Field(
        ...,
        ge=1, le=365,
        description="Length of stay in days (minimum 1 for inpatient)"
    )
    los_days_log: float = Field(
        ...,
        ge=0,
        description="Natural log of LOS (log1p transformed)"
    )
    admission_month: int = Field(
        ...,
        ge=1, le=12,
        description="Month of admission (1=January, 12=December)"
    )
    admission_dow: int = Field(
        ...,
        ge=0, le=6,
        description="Day of week (0=Monday, 6=Sunday)"
    )
    is_emergency: int = Field(
        ...,
        ge=0, le=1,
        description="1 if admitted via emergency department, 0 otherwise"
    )

    # --- Prior admission history ---
    n_admissions_prior_6m: int = Field(
        ...,
        ge=0, le=50,
        description="Number of inpatient admissions in prior 6 months"
    )
    n_admissions_prior_12m: int = Field(
        ...,
        ge=0, le=100,
        description="Number of inpatient admissions in prior 12 months"
    )
    n_ed_visits_prior_6m: int = Field(
        ...,
        ge=0, le=50,
        description="Number of ED visits in prior 6 months (E in LACE)"
    )
    days_since_last_admission: float = Field(
        ...,
        ge=0,
        description="Days since previous admission. 999 if no prior admission."
    )
    has_prior_admission: int = Field(
        ...,
        ge=0, le=1,
        description="1 if patient has any prior inpatient admission"
    )

    # --- Comorbidity features ---
    charlson_score: int = Field(
        ...,
        ge=0, le=30,
        description="Charlson Comorbidity Index score (C in LACE)"
    )
    n_active_conditions: int = Field(
        ...,
        ge=0, le=200,
        description="Total number of active clinical conditions"
    )
    has_heart_failure: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has heart failure diagnosis"
    )
    has_diabetes: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has diabetes mellitus diagnosis"
    )
    has_diabetes_complex: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has diabetes with complications"
    )
    has_copd: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has COPD diagnosis"
    )
    has_ckd: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has chronic kidney disease"
    )
    has_mi: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has history of myocardial infarction"
    )
    has_cancer: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has active cancer diagnosis"
    )
    has_dementia: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has dementia diagnosis"
    )
    has_cerebrovascular: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has cerebrovascular disease"
    )
    has_pvd: int = Field(
        ..., ge=0, le=1,
        description="1 if patient has peripheral vascular disease"
    )

    # --- Medication features ---
    n_medications_capped: float = Field(
        ...,
        ge=0, le=520,
        description="Active medication count (capped at 99th percentile)"
    )
    is_high_polypharmacy: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is on more than 10 medications"
    )
    has_insulin: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is prescribed insulin"
    )
    has_anticoagulant: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is prescribed anticoagulant therapy"
    )
    has_diuretic: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is prescribed diuretic therapy"
    )
    has_ace_inhibitor: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is prescribed ACE inhibitor"
    )

    # --- Demographic features ---
    age_at_admission: float = Field(
        ...,
        ge=18, le=120,
        description="Patient age at time of admission (adults only)"
    )
    gender_male: int = Field(
        ..., ge=0, le=1,
        description="1 if patient is male, 0 if female"
    )
    income: float = Field(
        ...,
        ge=0,
        description="Annual household income (socioeconomic proxy)"
    )

    @field_validator('los_days_log')
    @classmethod
    def validate_log_consistent(cls, v, info):
        """Verify log-transformed LOS is consistent with raw LOS."""
        import numpy as np
        if 'los_days' in info.data:
            expected = np.log1p(info.data['los_days'])
            if abs(v - expected) > 0.1:
                raise ValueError(
                    f"los_days_log ({v:.3f}) inconsistent with "
                    f"los_days ({info.data['los_days']}) — "
                    f"expected ~{expected:.3f}"
                )
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
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
    }


class RiskFactor(BaseModel):
    """A single SHAP-based risk factor contribution."""
    feature:     str   = Field(..., description="Feature name")
    value:       float = Field(..., description="Actual feature value")
    impact:      float = Field(..., description="SHAP contribution to prediction")
    direction:   str   = Field(..., description="'increases' or 'decreases' risk")
    description: str   = Field(..., description="Clinical plain-English explanation")


class PredictionResponse(BaseModel):
    """
    Full prediction response returned to the clinician or EHR system.
    
    Designed to be actionable — not just a number, but a clinical narrative
    with the reasoning behind the score and a recommended action.
    """
    readmission_risk:    float        = Field(..., description="Probability 0.0–1.0")
    risk_percent:        float        = Field(..., description="Probability as percentage")
    risk_category:       RiskCategory = Field(..., description="LOW / MEDIUM / HIGH")
    risk_score_display:  str          = Field(..., description="Human-readable risk display")
    top_risk_factors:    list[RiskFactor] = Field(..., description="Top SHAP contributors")
    recommendation:      str          = Field(..., description="Clinical action recommendation")
    model_version:       str          = Field(..., description="Model version identifier")
    disclaimer:          str          = Field(
        default="This prediction is a clinical decision support tool. "
                "It does not replace clinical judgement.",
        description="Mandatory clinical disclaimer"
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status:        str = Field(..., description="API status")
    model_loaded:  bool = Field(..., description="Whether model is loaded")
    model_version: str = Field(..., description="Model version")
    api_version:   str = Field(..., description="API version")