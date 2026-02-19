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
import traceback
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

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
load_dotenv()

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
                "email": "admin@painpoint.ai",
                "password": "admin123"
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
def health_check():
    """
    Health check endpoint with API key validation.
    
    Returns:
    - status: API operational status
    - api_key_configured: Whether OpenAI API key is set
    - message: Status message
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    key_configured = bool(api_key and api_key != "your_openai_api_key_here")
    
    return {
        "status": "ok",
        "api_key_configured": key_configured,
        "message": (
            "✅ OpenAI API key configured. Ready to analyze."
            if key_configured
            else "⚠️  WARNING: OPENAI_API_KEY not set. Please update your .env file."
        )
    }


@app.post("/api/login", tags=["Auth"])
def login(request: LoginRequest):
    """
    Simple authentication endpoint.
    
    Demo credentials:
    - email: admin@painpoint.ai
    - password: admin123
    """
    # Demo authentication (in production, use real database)
    if request.email == "admin@painpoint.ai" and request.password == "admin123":
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
#  STARTUP EVENT
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """
    Runs when the API starts up.
    Validates environment and prints status.
    """
    print("\n" + "="*60)
    print("🔮  PAINPOINT AI - BACKEND API")
    print("="*60)
    print("Status: Starting up...")
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key and api_key != "your_openai_api_key_here":
        print("✅ OpenAI API Key: Configured")
    else:
        print("⚠️  OpenAI API Key: NOT CONFIGURED")
        print("   Get your key at: https://platform.openai.com/api-keys")
        print("   Add to backend/.env file")
    
    print("\n📚 API Documentation: http://localhost:8000/docs")
    print("🏥 Health Check: http://localhost:8000/api/health")
    print("="*60 + "\n")


# ═══════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Catch-all error handler for unexpected errors.
    """
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc),
            "type": type(exc).__name__
        }
    )