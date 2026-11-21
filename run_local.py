"""
Run Local Server Script
Author: First-Year B.Tech Student Project
Purpose: Starts the FastAPI backend and serves the frontend on http://127.0.0.1:8000
"""

import sys
import uvicorn

if __name__ == "__main__":
    port = 8000
    print("=" * 75)
    print("🚀 STARTING KRISHIJAL: ALL-INDIA CROP STRESS & IRRIGATION PRIORITY SYSTEM")
    print("=" * 75)
    print(f"📍 ACCESS URLS (HOST: 0.0.0.0, PORT: {port}):")
    print(f"  • Project Overview:         http://127.0.0.1:{port}/")
    print(f"  • Health Check:             http://127.0.0.1:{port}/health")
    print(f"  • Swagger UI (API Docs):    http://127.0.0.1:{port}/docs")
    print(f"  • Alternative Docs (Redoc): http://127.0.0.1:{port}/redoc")
    print(f"  • ML Prediction Endpoint:   POST http://127.0.0.1:{port}/predict")
    print(f"  • Interactive Web App:      http://127.0.0.1:{port}/app/")
    print("=" * 75)
    print("Server running. Press CTRL+C to terminate.\n")
    
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
