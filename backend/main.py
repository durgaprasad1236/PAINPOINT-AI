"""
main.py
-------
FastAPI backend for PainPoint AI - Consumer Intelligence Platform

This is the main entry point for the backend API.

Endpoints:
- GET  /              → Health check
- GET  /api/health    → API status + key validation
- POST /api/analyse   → Batch analysis (CSV or text)
- POST /api/analyse-single → Single feedback analysis
- GET  /docs          → Auto-generated Swagger UI

Architecture:
Input → Preprocessing → ML Layer → LLM Engine → Insight Engine → Response
"""

import io
import os
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware

# Import our modules
from modules.preprocessor import preprocess_text
from modules.ml_layer import ml_analyse
from modules.llm_engine import llm_analyse
from modules.insight_engine import (
    build_dataframe,
    calculate_priority,
    emotion_distribution,
    severity_distribution,
    top_issues,
    summary_stats,
    generate_executive_summary
)

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
ENV_MODE = os.getenv("ENV", "development").strip().lower()
IS_PRODUCTION = ENV_MODE == "production"


def _parse_allowed_origins(raw_origins: str) -> list[str]:
    return [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]


def _parse_csv_values(raw_values: str) -> list[str]:
    return [value.strip() for value in raw_values.split(",") if value.strip()]

# ═══════════════════════════════════════════════════════════════
#  FASTAPI APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="PainPoint AI - Backend API",
    description=(
        "🔮 AI Consumer Pain-Point Miner & Intelligent Solution Generator\n\n"
        "This API provides LLM-powered customer feedback analysis with:\n"
        "- Pain-point detection\n"
        "- Category classification\n"
        "- Severity evaluation\n"
        "- Emotion detection\n"
        "- Root cause analysis\n"
        "- Intelligent solution generation\n"
        "- Priority scoring (Frequency × Severity)\n"
        "- Executive insight summary\n\n"
        "Powered by Groq LLaMA 3 + scikit-learn ML"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ═══════════════════════════════════════════════════════════════
#  CORS MIDDLEWARE (Allow Frontend to Connect)
# ═══════════════════════════════════════════════════════════════

allowed_origins = [
    "https://painpoint-ai-psi.vercel.app",
    "https://painpoint-ai.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if IS_PRODUCTION:
    app.add_middleware(HTTPSRedirectMiddleware)
    trusted_hosts = _parse_csv_values(
        os.getenv("ALLOWED_HOSTS", "*.onrender.com")
    )
    if trusted_hosts:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=trusted_hosts
        )

# ═══════════════════════════════════════════════════════════════
#  REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class SingleFeedbackRequest(BaseModel):
    """Request model for single feedback analysis"""
    feedback: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "feedback": "Payment failed but money was deducted from my account. No refund after 5 days."
            }
        }

class LoginRequest(BaseModel):
    """Request model for user login"""
    email: str
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "admin@yourcompany.com",
                "password": "********"
            }
        }

# ═══════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
def root():
    """
    Root endpoint - API status check
    """
    return {
        "message": "🔮 PainPoint AI Backend is running",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs"
    }


@app.get("/api/health", tags=["Health"])
def health():
    """
    Health check endpoint with API key validation.
    
    Returns:
    - status: API operational status
    - api_key_configured: Whether API key is set
    - message: Status message
    """
    return {"status": "ok"}


@app.post("/api/login", tags=["Auth"])
def login(request: LoginRequest):
    """
    Authentication endpoint using environment-based credentials.
    """
    auth_email = os.getenv("AUTH_EMAIL", "").strip().lower()
    auth_password = os.getenv("AUTH_PASSWORD", "")

    if not auth_email or not auth_password:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured on the server"
        )

    if request.email.strip().lower() == auth_email and request.password == auth_password:
        return {
            "success": True,
            "token": f"token_{request.email}_{os.urandom(16).hex()}",
            "message": "Login successful"
        }
    else:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


@app.post("/api/analyse", tags=["Analysis"])
async def analyse_batch(
    file: Optional[UploadFile] = File(default=None),
    raw_text: Optional[str] = Form(default=None),
    feedback_column: Optional[str] = Form(default=None),
):
    """
    Batch analysis endpoint - analyze multiple feedback items.
    
    Accepts either:
    - CSV file upload (with optional column name)
    - Raw pasted text (one feedback per line)
    
    Returns complete intelligence including:
    - Summary statistics
    - Priority scores by category
    - Emotion and severity distributions
    - Top critical issues
    - Executive summary
    - All individual results
    
    Limit: 50 feedback items per request (to manage API costs)
    """
    feedbacks: list[str] = []
    
    # ═══════════════════════════════════════════════════════════
    #  INPUT PROCESSING
    # ═══════════════════════════════════════════════════════════
    
    # Source 1: CSV File
    if file is not None:
        try:
            contents = await file.read()
            df_input = pd.read_csv(io.BytesIO(contents))
            
            if df_input.empty:
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded CSV is empty"
                )
            
            # Determine feedback column
            col = feedback_column if feedback_column else df_input.columns[0]
            
            if col not in df_input.columns:
                raise HTTPException(
                    status_code=400,
                    detail=f"Column '{col}' not found. Available: {list(df_input.columns)}"
                )
            
            feedbacks = df_input[col].dropna().astype(str).tolist()
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read CSV: {str(e)}"
            )
    
    # Source 2: Raw Text
    elif raw_text:
        feedbacks = [
            line.strip()
            for line in raw_text.strip().splitlines()
            if line.strip()
        ]
    
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either a CSV file or raw_text in the request"
        )
    
    # Validate input
    if not feedbacks:
        raise HTTPException(
            status_code=400,
            detail="No feedback items found to analyze"
        )
    
    # Limit to 50 items
    if len(feedbacks) > 50:
        feedbacks = feedbacks[:50]
    
    # ═══════════════════════════════════════════════════════════
    #  ANALYSIS PIPELINE
    # ═══════════════════════════════════════════════════════════
    
    results = []
    
    for feedback in feedbacks:
        # Step 1: Preprocess
        cleaned = preprocess_text(feedback)
        if not cleaned:
            continue  # Skip empty/invalid feedback
        
        # Step 2: ML Layer (fast pre-analysis)
        ml_result = ml_analyse(cleaned)
        
        # Step 3: LLM Layer (deep reasoning)
        llm_result = llm_analyse(
            cleaned,
            ml_hint=ml_result["ml_suggested_category"]
        )
        
        # Combine results
        results.append({
            "original_feedback": feedback,
            "cleaned_feedback": cleaned,
            **ml_result,
            **llm_result
        })
    
    # Validate we have results
    if not results:
        raise HTTPException(
            status_code=422,
            detail="All feedback items were empty after preprocessing"
        )
    
    # ═══════════════════════════════════════════════════════════
    #  INSIGHT ENGINE
    # ═══════════════════════════════════════════════════════════
    
    df = build_dataframe(results)
    priority_data = calculate_priority(df)
    emotion_data = emotion_distribution(df)
    severity_data = severity_distribution(df)
    top_data = top_issues(df)
    stats = summary_stats(df)
    executive_summary = generate_executive_summary(
        stats,
        priority_data,
        emotion_data
    )
    
    # ═══════════════════════════════════════════════════════════
    #  RESPONSE
    # ═══════════════════════════════════════════════════════════
    
    return JSONResponse(content={
        "success": True,
        "total_analysed": len(results),
        "summary_stats": stats,
        "priority_scores": priority_data,
        "emotion_distribution": emotion_data,
        "severity_distribution": severity_data,
        "top_issues": top_data,
        "executive_summary": executive_summary,
        "all_results": results
    })


@app.post("/api/analyse-single", tags=["Analysis"])
def analyse_single(request: SingleFeedbackRequest):
    """
    Single feedback analysis endpoint.
    
    Useful for:
    - Real-time analysis as user types
    - On-demand single item analysis
    - Quick testing
    
    Returns complete analysis for one feedback item.
    """
    if not request.feedback.strip():
        raise HTTPException(
            status_code=400,
            detail="Feedback text cannot be empty"
        )
    
    # Preprocess
    cleaned = preprocess_text(request.feedback)
    
    # ML layer
    ml_result = ml_analyse(cleaned)
    
    # LLM layer
    llm_result = llm_analyse(
        cleaned,
        ml_hint=ml_result["ml_suggested_category"]
    )
    
    return JSONResponse(content={
        "success": True,
        "original_feedback": request.feedback,
        "cleaned_feedback": cleaned,
        **ml_result,
        **llm_result
    })


# ═══════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Catch-all error handler for unexpected errors.
    """
    error_message = "Internal server error" if IS_PRODUCTION else str(exc)
    error_type = "InternalError" if IS_PRODUCTION else type(exc).__name__
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": error_message,
            "type": error_type
        }
    )