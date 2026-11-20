"""
Run Local Server Script
Author: First-Year B.Tech Student Project
Purpose: Starts the FastAPI backend and serves the frontend on http://127.0.0.1:8000
"""

import sys
import uvicorn

if __name__ == "__main__":
    print("=" * 75)
    print("🚀 STARTING KRISHIJAL: ALL-INDIA CROP STRESS & IRRIGATION PRIORITY SYSTEM")
    print("=" * 75)
    print("📍 ACCESS URLS (LOCAL DEPLOYMENT):")
    print("  • Project Overview:         http://127.0.0.1:8000/")
    print("  • Health Check:             http://127.0.0.1:8000/health")
    print("  • Swagger UI (API Docs):    http://127.0.0.1:8000/docs")
    print("  • Alternative Docs (Redoc): http://127.0.0.1:8000/redoc")
    print("  • ML Prediction Endpoint:   POST http://127.0.0.1:8000/predict")
    print("  • Interactive Web App:      http://127.0.0.1:8000/app/")
    print("=" * 75)
    print("Server running locally. Press CTRL+C to terminate.\n")
    
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
