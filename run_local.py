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
    print("📍 ACCESS URLS:")
    print("  • Web Frontend UI:          http://127.0.0.1:8000/app/")
    print("  • Backend API Status:       http://127.0.0.1:8000/")
    print("  • Interactive API Docs:     http://127.0.0.1:8000/docs")
    print("  • Alternative Swagger/Docs: http://127.0.0.1:8000/redoc")
    print("=" * 75)
    print("Server running locally. Press CTRL+C to terminate.\n")
    
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
