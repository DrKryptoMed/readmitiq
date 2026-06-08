"""
Model loading and inference engine.

Loads XGBoost model, scaler, and SHAP explainer once at startup.
All prediction requests are handled through the Predictor class.

Design principle: load once, predict many times.
Loading a model on every request would be 10-100x slower.
"""

import joblib
import numpy as np
import pandas as pd
import shap
import logging
from pathlib import Path
from typing import Optional

from src.api.models import (
    PatientFeatures,
    PredictionResponse,
    RiskCategory,
    RiskFactor,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Feature order must match exactly what the model was trained on
# Any mismatch causes silent wrong predictions — worse than an error
FEATURE_ORDER = [
    'los_days', 'los_days_log', 'admission_month', 'admission_dow',
    'is_emergency', 'n_admissions_prior_6m', 'n_admissions_prior_12m',
    'n_ed_visits_prior_6m', 'days_since_last_admission',
    'has_prior_admission', 'charlson_score', 'n_active_conditions',
    'has_heart_failure', 'has_diabetes', 'has_diabetes_complex',
    'has_copd', 'has_ckd', 'has_mi', 'has_cancer', 'has_dementia',
    'has_cerebrovascular', 'has_pvd', 'n_medications_capped',
    'is_high_polypharmacy', 'has_insulin', 'has_anticoagulant',
    'has_diuretic', 'has_ace_inhibitor', 'age_at_admission',
    'gender_male', 'income',
]

# Clinical descriptions for each feature
# Used to generate plain-English explanations in the response
FEATURE_DESCRIPTIONS = {
    'los_days':                   'Length of hospital stay',
    'los_days_log':               'Length of hospital stay (log scale)',
    'admission_month':            'Month of admission',
    'admission_dow':              'Day of week admitted',
    'is_emergency':               'Emergency admission',
    'n_admissions_prior_6m':      'Hospital admissions in past 6 months',
    'n_admissions_prior_12m':     'Hospital admissions in past 12 months',
    'n_ed_visits_prior_6m':       'Emergency department visits in past 6 months',
    'days_since_last_admission':  'Days since last hospital admission',
    'has_prior_admission':        'History of prior hospitalisation',
    'charlson_score':             'Charlson Comorbidity Index score',
    'n_active_conditions':        'Number of active medical conditions',
    'has_heart_failure':          'Heart failure diagnosis',
    'has_diabetes':               'Diabetes mellitus diagnosis',
    'has_diabetes_complex':       'Diabetes with complications',
    'has_copd':                   'Chronic obstructive pulmonary disease',
    'has_ckd':                    'Chronic kidney disease',
    'has_mi':                     'History of myocardial infarction',
    'has_cancer':                 'Active cancer diagnosis',
    'has_dementia':               'Dementia diagnosis',
    'has_cerebrovascular':        'Cerebrovascular disease',
    'has_pvd':                    'Peripheral vascular disease',
    'n_medications_capped':       'Number of active medications',
    'is_high_polypharmacy':       'High polypharmacy (>10 medications)',
    'has_insulin':                'Insulin therapy',
    'has_anticoagulant':          'Anticoagulant therapy',
    'has_diuretic':               'Diuretic therapy',
    'has_ace_inhibitor':          'ACE inhibitor therapy',
    'age_at_admission':           'Patient age at admission',
    'gender_male':                'Male gender',
    'income':                     'Household income',
}

# Risk thresholds — calibrated to our model's output distribution
# LOW:    < 20% — standard discharge
# MEDIUM: 20-50% — enhanced follow-up
# HIGH:   > 50% — intensive intervention
RISK_THRESHOLDS = {
    'LOW':    0.20,
    'MEDIUM': 0.50,
}

# Clinical recommendations by risk category
RECOMMENDATIONS = {
    RiskCategory.LOW: (
        "Standard discharge protocol. "
        "Schedule routine 30-day follow-up appointment. "
        "Provide patient with discharge summary and medication list."
    ),
    RiskCategory.MEDIUM: (
        "Enhanced discharge protocol. "
        "Schedule 14-day follow-up appointment. "
        "Conduct pharmacist medication reconciliation. "
        "Provide patient education on warning signs requiring ED return."
    ),
    RiskCategory.HIGH: (
        "High-risk discharge protocol. "
        "Schedule 7-day follow-up appointment. "
        "Assign care coordinator for post-discharge monitoring. "
        "Conduct pharmacist medication reconciliation before discharge. "
        "Consider social work referral if social support is limited. "
        "Confirm patient has transport and medication access post-discharge."
    ),
}


class Predictor:
    """
    Manages model lifecycle and inference.
    
    Loaded once at API startup via FastAPI lifespan events.
    Thread-safe for concurrent requests — models are read-only after loading.
    """

    def __init__(self, models_path: str = "models"):
        self.models_path   = Path(models_path)
        self.model         = None
        self.scaler        = None
        self.explainer     = None
        self.model_version = "xgboost_v1_auc0.891"
        self._loaded       = False

    def load(self) -> None:
        """
        Load model, scaler, and SHAP explainer from disk.
        Called once at API startup — not on every request.
        """
        logger.info("Loading model artifacts...")

        try:
            # Load XGBoost model
            model_path = self.models_path / "xgboost_model.pkl"
            self.model = joblib.load(model_path)
            logger.info(f"Model loaded from {model_path}")

            # Load scaler — must be the same scaler used in training
            scaler_path = self.models_path / "scaler.pkl"
            self.scaler = joblib.load(scaler_path)
            logger.info(f"Scaler loaded from {scaler_path}")

            # Build SHAP explainer — TreeExplainer for XGBoost
            # This is slow to build (~5s) but fast to query
            self.explainer = shap.TreeExplainer(self.model)
            logger.info("SHAP explainer ready")

            self._loaded = True
            logger.info(
                f"All artifacts loaded successfully. "
                f"Model version: {self.model_version}"
            )

        except FileNotFoundError as e:
            logger.error(f"Model file not found: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _features_to_array(
        self, features: PatientFeatures
    ) -> pd.DataFrame:
        """Convert Pydantic model to DataFrame in correct feature order."""
        feature_dict = features.model_dump()
        ordered = {f: [feature_dict[f]] for f in FEATURE_ORDER}
        return pd.DataFrame(ordered)

    def _get_risk_category(
        self, probability: float
    ) -> RiskCategory:
        """Map probability to clinical risk category."""
        if probability < RISK_THRESHOLDS['LOW']:
            return RiskCategory.LOW
        elif probability < RISK_THRESHOLDS['MEDIUM']:
            return RiskCategory.MEDIUM
        else:
            return RiskCategory.HIGH

    def _compute_shap_factors(
        self,
        raw_array: np.ndarray,
        features: PatientFeatures,
        top_n: int = 5
    ) -> list[RiskFactor]:
        """
        Compute SHAP values and return top N risk factors
        with clinical plain-English descriptions.
        """
        shap_values = self.explainer.shap_values(raw_array)[0]

        feature_dict = features.model_dump()

        # Build list of (feature, value, shap_value)
        factors = [
            (feat, feature_dict[feat], shap_val)
            for feat, shap_val in zip(FEATURE_ORDER, shap_values)
        ]

        # Sort by absolute SHAP value — largest impact first
        factors_sorted = sorted(
            factors, key=lambda x: abs(x[2]), reverse=True
        )[:top_n]

        risk_factors = []
        for feat, val, shap_val in factors_sorted:
            risk_factors.append(RiskFactor(
                feature=feat,
                value=round(float(val), 3),
                impact=round(float(shap_val), 4),
                direction="increases" if shap_val > 0 else "decreases",
                description=FEATURE_DESCRIPTIONS.get(feat, feat)
            ))

        return risk_factors

    def predict(self, features: PatientFeatures) -> PredictionResponse:
        """
        Run full prediction pipeline for one patient.
        
        Steps:
        1. Convert features to array in correct order
        2. Scale features using training scaler
        3. Get probability from XGBoost
        4. Compute SHAP values for explainability
        5. Build structured clinical response
        
        Returns:
            PredictionResponse with risk score, category,
            SHAP factors, and clinical recommendation
        """
        if not self._loaded:
            raise RuntimeError(
                "Model not loaded. Call predictor.load() first."
            )

        # Step 1 — features to array
        raw_df = self._features_to_array(features)

        # Step 2 — scale
        scaled_array = self.scaler.transform(raw_df)

        # Step 3 — predict probability
        probability = float(
            self.model.predict_proba(scaled_array)[0][1]
        )

        # Step 4 — SHAP explanation
        risk_factors = self._compute_shap_factors(
            scaled_array, features, top_n=5
        )

        # Step 5 — build response
        risk_category = self._get_risk_category(probability)
        risk_percent  = round(probability * 100, 1)

        return PredictionResponse(
            readmission_risk   = round(probability, 4),
            risk_percent       = risk_percent,
            risk_category      = risk_category,
            risk_score_display = f"{risk_percent}% readmission risk",
            top_risk_factors   = risk_factors,
            recommendation     = RECOMMENDATIONS[risk_category],
            model_version      = self.model_version,
        )


# Global predictor instance
# Imported by routers — loaded once at startup
predictor = Predictor()