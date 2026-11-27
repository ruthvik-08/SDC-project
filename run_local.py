import uvicorn

if __name__ == "__main__":
    port = 8000
    print("=" * 75)
    print("STARTING KRISHIJAL: ALL-INDIA CROP STRESS & IRRIGATION PRIORITY SYSTEM")
    print("=" * 75)
    print("Project Overview:         http://127.0.0.1:" + str(port) + "/")
    print("Health Check:             http://127.0.0.1:" + str(port) + "/health")
    print("Swagger UI (API Docs):    http://127.0.0.1:" + str(port) + "/docs")
    print("Alternative Docs (Redoc): http://127.0.0.1:" + str(port) + "/redoc")
    print("ML Prediction Endpoint:   POST http://127.0.0.1:" + str(port) + "/predict")
    print("Interactive Web App:      http://127.0.0.1:" + str(port) + "/app/")
    print("=" * 75)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
