# Model Card — ReadmitIQ 30-Day Readmission Risk Model

This card follows the structure proposed in *Model Cards for Model Reporting* (Mitchell et al., 2019) and is intended to support transparent, responsible use of the model.

---

## Model details

| | |
|---|---|
| **Model name** | `xgboost_v1_auc0.891` |
| **Model type** | Gradient-boosted decision trees (XGBoost binary classifier) |
| **Version** | 1.0 |
| **Date** | June 2026 |
| **Developer** | Ibrahim Aremu Mikail |
| **Baseline compared against** | L2-regularised logistic regression |
| **Output** | Probability of unplanned readmission within 30 days of discharge, plus risk category (LOW / MEDIUM / HIGH) and SHAP-based explanation |
| **License** | MIT |

### Architecture and training configuration

- 300 estimators, max depth 4, learning rate 0.05, subsample 0.8, column subsample 0.8.
- Class imbalance handled with SMOTE (training data only) plus `scale_pos_weight`.
- Features standardised with a scaler fitted on training data only.
- Probability threshold for class assignment: 0.5; category thresholds: LOW < 20%, MEDIUM 20–50%, HIGH > 50%.

---

## Intended use

### Primary intended use

Decision support at the point of inpatient discharge. The model flags adult patients at elevated risk of 30-day readmission so that care teams can prioritise transitional-care interventions (medication reconciliation, early follow-up scheduling, care-coordinator or social-work referral).

### Intended users

Clinicians, discharge planners, and care-coordination teams, used alongside — not instead of — clinical judgement.

### Out-of-scope uses

- **Not** a diagnostic device.
- **Not** for autonomous decision-making, resource denial, or insurance/coverage determinations.
- **Not** validated for paediatric patients (training cohort is adults ≥18 only).
- **Not** validated for any real-world population (see Limitations).

---

## Training data

| | |
|---|---|
| **Source** | Synthea synthetic patient records (no real PHI) |
| **Raw population** | 11,381 synthetic patients |
| **Modelling cohort** | 3,680 adult inpatient encounters |
| **Outcome prevalence** | 8.7% (321 readmissions) |
| **Label definition** | Unplanned inpatient readmission within 30 days, CMS-style exclusions (minimum length of stay, gap rules, last-admission-per-patient excluded) |

### Features (31)

All features are knowable at the moment of discharge to prevent target leakage.

- **Prior utilisation:** admissions in prior 6 and 12 months, ED visits in prior 6 months, days since last admission, prior-admission flag.
- **Comorbidity:** Charlson Comorbidity Index, active condition count, disease flags (heart failure, diabetes, COPD, CKD, cancer, MI, dementia, cerebrovascular, PVD, and others).
- **Medications:** capped active medication count, polypharmacy flag, high-risk drug-class flags (anticoagulant, insulin, diuretic, ACE inhibitor).
- **Demographics:** age at admission, gender, income proxy, admission timing.

---

## Evaluation

Evaluated on a stratified 20% hold-out test set (736 encounters, 64 readmissions) that retains the real 8.7% prevalence. SMOTE was **not** applied to the test set.

| Metric | Logistic regression | XGBoost |
|---|---|---|
| AUC-ROC | 0.836 | **0.891** |
| Average precision | 0.414 | **0.455** |
| Recall (readmitted) | 0.69 | **0.77** |
| Precision (readmitted) | 0.37 | 0.36 |
| Brier score | 0.103 | 0.108 |

The model catches 77% of true readmissions. Recall is deliberately favoured over precision: in readmission prevention the cost of a missed high-risk patient outweighs the cost of a false alarm.

### Top predictors (mean |SHAP|)

1. Active medication count
2. Days since last admission
3. Age at admission
4. Active condition count
5. Charlson Comorbidity Index

Prior-admission signal is distributed across several correlated features; XGBoost exploits this structure, which is why it outperforms the linear baseline.

---

## Fairness analysis

Audited with IBM AIF360 across gender and age subgroups.

| Group | Disparate impact (fair: 0.8–1.2) | Equal-opportunity diff (fair: ±0.1) | Verdict |
|---|---|---|---|
| Gender (Male vs Female) | 1.094 | 0.024 | PASS |
| Age (≥75 vs <75) | 0.922 | −0.053 | PASS |

Subgroup AUC-ROC stayed within ±0.05 of the overall 0.891 for every measurable group.

**Flag for monitoring:** the gender average-odds difference was 0.107, marginally above the ±0.10 threshold — the model predicts slightly more aggressively for males, consistent with their higher observed readmission rate in this data. This is documented for monitoring rather than treated as disqualifying. The 18–40 age group had too few positive cases for reliable subgroup evaluation.

---

## Limitations

- **Synthetic data.** The model is trained on Synthea, not real EHR data. Absolute probabilities and certain feature effects are not clinically validated.
- **Simulation artefacts.** The cancer signal and the (counter-intuitive) positive income effect likely reflect how Synthea generates utilisation rather than true clinical relationships. Both would need re-examination on real data.
- **Calibration.** XGBoost is slightly less calibrated than the linear baseline; probability calibration (Platt/isotonic) is planned.
- **Small positive class.** 321 readmissions limit the statistical reliability of the smallest subgroup metrics.
- **No temporal or external validation.** Production deployment would require validation on a held-out future period and a real external cohort, plus prospective monitoring.

---

## Ethical considerations

- The model must never be used to deny care or coverage.
- Risk flags should trigger *additional* support, not reduced attention.
- Outputs are explainable by design (SHAP) so clinicians can scrutinise and override them.
- A real-world deployment would require IRB/ethics review, prospective validation, bias monitoring on live data, and a human-in-the-loop workflow.

---

## Quantitative reproducibility

Notebook and deployed API produce identical predictions and SHAP values (verified to four decimal places) for fixed inputs, confirming the deployed artifact matches the trained model. All training runs are versioned in MLflow on DagsHub.

---

*This model is a portfolio demonstration of clinical AI engineering practice. It is not a medical device and is not approved for clinical use.*
