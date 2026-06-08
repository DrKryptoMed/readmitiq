"""
FastAPI application entry point.

Wires together:
- Application lifecycle (model loading at startup)
- Route registration
- Middleware (CORS, logging)
- Health check endpoint
- Interactive API documentation

Run with:
    uvicorn src.api.main:app --reload --port 8000
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.models import HealthResponse
from src.api.predictor import predictor
from src.api.routers import predict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)


# --- Lifespan: load model at startup, clean up at shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler.

    Runs at startup: loads model artifacts into memory.
    Runs at shutdown: logs graceful shutdown.

    Using lifespan instead of @app.on_event is the modern
    FastAPI pattern — on_event is deprecated as of FastAPI 0.93.
    """
    # Startup
    logger.info("Starting Readmission Risk API...")
    logger.info("Loading model artifacts — this takes ~5 seconds...")

    try:
        predictor.load()
        logger.info("API ready to serve predictions")
    except Exception as e:
        logger.error(f"Failed to load model at startup: {e}")
        logger.error("API will start but /predict endpoints will return 503")

    yield  # API is running here

    # Shutdown
    logger.info("Shutting down Readmission Risk API...")


# --- Application ---
app = FastAPI(
    title="30-Day Readmission Risk API",
    description="""
## Clinical Decision Support — Readmission Risk Prediction

Predicts 30-day hospital readmission risk at the point of patient discharge
using an XGBoost model trained on synthetic clinical data (Synthea).

### Model Performance
- **AUC-ROC:** 0.891 (exceeds 0.75 clinical benchmark)
- **Recall:** 77% (catches 4 in 5 readmissions)
- **Fairness:** Audited with IBM AIF360 — PASS for gender and age

### Endpoints
- `POST /predict/features` — predict from engineered features
- `GET /predict/example` — sample high-risk patient
- `GET /health` — API health check

### Clinical Disclaimer
This tool is a **clinical decision support system**.
It does not replace clinical judgement. All predictions
should be interpreted in the context of the full clinical picture.

### Model Version
`xgboost_v1_auc0.891` — trained June 2026
    """,
    version="1.0.0",
    contact={
        "name": "Ibrahim — Health Tech Engineer",
        "url": "https://drkryptomed.github.io",
    },
    lifespan=lifespan,
)


# --- CORS Middleware ---
# Required for browser-based frontends to call the API
# In production: replace ["*"] with specific frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request logging middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with timing information."""
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000

    logger.info(
        f"{request.method} {request.url.path} — "
        f"{response.status_code} — "
        f"{duration:.1f}ms"
    )
    return response


# --- Health check ---
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API health check",
    description="Returns API status and model loading state. "
                "Use this to verify the service is ready before sending predictions.",
)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns 200 if API is running.
    Check model_loaded field to confirm predictions are available.
    """
    return HealthResponse(
        status="healthy" if predictor.is_loaded else "degraded",
        model_loaded=predictor.is_loaded,
        model_version=predictor.model_version,
        api_version="1.0.0",
    )


# --- Root endpoint ---
@app.get(
    "/",
    tags=["System"],
    summary="API root",
)
async def root():
    """Redirect information for API root."""
    return {
        "message": "30-Day Readmission Risk API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "predict": "/predict/features",
    }


# --- Register routers ---
app.include_router(predict.router)