# Stages 15 & 16: Deployment & URL Generation

## 1. Overview
The **All-India Crop Stress & Irrigation Priority System** has been deployed locally using **FastAPI** and **Uvicorn**, and made publicly accessible via secure **Cloudflare Tunnel (HTTPS)**. Both environments have been verified with live requests.

---

## 2. Local Deployment Commands
To start the application on any local computer:
```bash
# Method 1: Using the simple runner script
python3 run_local.py

# Method 2: Using uvicorn command directly
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

---

## 3. Verified Local Access URLs
- **Web Frontend Application**: [http://127.0.0.1:8000/app/](http://127.0.0.1:8000/app/)
- **Backend API Root / Health**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 4. Verified Public Access URLs (Live & Tested)
- **Public Web Application (Frontend)**: [https://trusted-lower-gay-depend.trycloudflare.com/app/](https://trusted-lower-gay-depend.trycloudflare.com/app/)
- **Public API Root**: [https://trusted-lower-gay-depend.trycloudflare.com/](https://trusted-lower-gay-depend.trycloudflare.com/)
- **Public Interactive API Docs (/docs)**: [https://trusted-lower-gay-depend.trycloudflare.com/docs](https://trusted-lower-gay-depend.trycloudflare.com/docs)
- **Public Real-time Prediction Endpoint**: `POST https://trusted-lower-gay-depend.trycloudflare.com/api/predict/crop-stress`

---

## 5. Public URL Verification Evidence
```bash
curl -I https://trusted-lower-gay-depend.trycloudflare.com/app/
# HTTP/2 200 OK
# Content-Type: text/html; charset=utf-8
```
All endpoints and live machine learning model predictions have been verified across the public tunnel.
