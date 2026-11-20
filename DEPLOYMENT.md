# 🚀 KrishiJal Dual Deployment Guide
### *Comprehensive Step-by-Step Manual for Local + Ngrok and Render Cloud Deployments*

**Project:** KrishiJal – Crop Stress and Irrigation Priority Decision Support System  
**Repository:** [https://github.com/ruthvik-08/SDC-project.git](https://github.com/ruthvik-08/SDC-project.git)  
**Academic Target:** SDC Faculty Evaluation & Real-World Agricultural Decision Support  

---

## 1. Dual Deployment Architecture Overview

KrishiJal provides a single, unified codebase supporting **two independent production deployment options**:

```
                              ┌────────────────────────────────────────┐
                              │      KrishiJal Master Codebase         │
                              │   (FastAPI Backend + ML Models + UI)   │
                              └──────────────────┬─────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
    ┌─────────────────────────────┐                             ┌─────────────────────────────┐
    │          OPTION A           │                             │          OPTION B           │
    │   Local FastAPI + Ngrok     │                             │   Render Cloud Hosting      │
    ├─────────────────────────────┤                             ├─────────────────────────────┤
    │ • Host: Local Machine (Mac) │                             │ • Host: Render Cloud Linux  │
    │ • Port: 8000                │                             │ • Port: Dynamic ($PORT)     │
    │ • Tunnel: Ngrok HTTPS       │                             │ • Domain: onrender.com      │
    │ • Zero cloud cost           │                             │ • Fully independent of Mac  │
    └─────────────────────────────┘                             └─────────────────────────────┘
```

Both deployment options utilize the **exact same 14-feature Scikit-Learn models**, **same pre-trained persistent pipelines**, and **same interactive frontend**.

---

## 2. Centralized Configuration & Environment Switching

The project uses dynamic, environment-aware configuration across both frontend and backend:

1. **Backend Dynamic Port Binding:**
   - [run_local.py](file:///Users/p.ruthvik/Desktop/sdc_project/run_local.py) and [main.py](file:///Users/p.ruthvik/Desktop/sdc_project/backend/main.py) check `os.environ.get("PORT", 8000)`.
   - On a local machine or with Ngrok, it binds to `0.0.0.0:8000`.
   - On Render, it automatically reads the `$PORT` environment variable injected by the Render cloud platform.

2. **Frontend Dynamic API Resolution ([app.js](file:///Users/p.ruthvik/Desktop/sdc_project/frontend/app.js)):**
   - Automatically detects `window.location.origin`.
   - If running via Ngrok (`https://...ngrok-free.dev/app/`), requests automatically route to the Ngrok backend.
   - If running via Render (`https://...onrender.com/app/`), requests automatically route to the Render cloud backend.
   - If running locally (`http://127.0.0.1:8000/app/`), requests route to localhost.
   - For standalone testing (e.g., Live Server on port 5500 or `file://`), run `setKrishiJalApiBase("https://your-url")` in the browser console.

---

## 3. Option A: Local FastAPI + Ngrok Public Tunneling

### Prerequisites
1. Python 3.10+ installed (`python3 --version`)
2. Ngrok CLI installed:
   ```bash
   brew install ngrok/ngrok/ngrok  # On macOS
   # Or download from https://ngrok.com/download
   ```
3. A free Ngrok account and authtoken from [https://dashboard.ngrok.com](https://dashboard.ngrok.com)

---

### Step 1: Install Dependencies
From the repository root:
```bash
pip install -r requirements.txt
```

---

### Step 2: Configure Ngrok Authtoken (One-Time Setup)
Add your personal authtoken (replace `<YOUR_AUTHTOKEN>` with your actual token from the Ngrok dashboard):
```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```
*Note: Do not type `$YOUR_AUTHTOKEN` literally unless you have exported it as an environment variable.*

---

### Step 3: Start the Local FastAPI Backend
From the project root:
```bash
python3 run_local.py
```
*Alternative command (run directly from project root):*
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*Alternative command (run from the `backend/` directory):*
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Verify local startup:
- Local API Root: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- Local Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Local Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Local Web Application: [http://127.0.0.1:8000/app/](http://127.0.0.1:8000/app/)

---

### Step 4: Start the Ngrok Public Tunnel
In a **separate terminal window**, start the Ngrok tunnel pointing to port 8000:
```bash
ngrok http 8000
```
If you have a reserved static Ngrok free domain (e.g., `postnasal-elated-clapped.ngrok-free.dev`):
```bash
ngrok http 8000 --url postnasal-elated-clapped.ngrok-free.dev
```

Ngrok terminal display:
```
Session Status                online
Account                       <Your Name> (Plan: Free)
Forwarding                    https://<your-subdomain>.ngrok-free.dev -> http://localhost:8000
```

---

### Step 5: Verify Public Access through Ngrok
Open the forwarded URL in any web browser, phone, or tablet:
- **Public Web Application:** `https://<your-subdomain>.ngrok-free.dev/app/`
- **Public Swagger Documentation:** `https://<your-subdomain>.ngrok-free.dev/docs`
- **Public Health Check:** `https://<your-subdomain>.ngrok-free.dev/health`

---

### Step 6: How to Stop Local Deployment & Ngrok
- In the FastAPI terminal: press `CTRL + C`
- In the Ngrok terminal: press `CTRL + C`
- If a background process remains open:
  ```bash
  pkill -f "uvicorn"
  pkill -f "ngrok"
  ```

---

## 4. Option B: Cloud Deployment on Render

Render provides a 100% cloud-hosted deployment that runs 24/7 independently of your local computer.

### Prerequisites
1. A GitHub account with access to [https://github.com/ruthvik-08/SDC-project](https://github.com/ruthvik-08/SDC-project)
2. A free account on [https://render.com](https://render.com)

---

### Deployment Method 1: Using Render Blueprint (`render.yaml` - Automatic)
The repository contains a pre-configured [render.yaml](file:///Users/p.ruthvik/Desktop/sdc_project/render.yaml) blueprint:
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub account and select the repository `ruthvik-08/SDC-project`.
4. Render automatically detects `render.yaml` and provisions the web service.
5. Click **Apply**. Render will build and deploy the service.

---

### Deployment Method 2: Manual Web Service Setup
If creating the service manually through the Render UI:

1. Click **New +** > **Web Service**.
2. Select **Build and deploy from a Git repository** > Click **Next**.
3. Choose repository: `ruthvik-08/SDC-project`.
4. Fill in the service configuration:
   - **Name:** `krishijal-decision-support` (or any preferred name)
   - **Region:** `Singapore (Southeast Asia)` or `Frankfurt` (closest to your users)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank — runs from project root)*
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free`

5. **Advanced Settings:**
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** `Yes` (deploys automatically on git push)
   - **Environment Variables:**
     - `PYTHON_VERSION`: `3.11.9`

6. Click **Create Web Service**.

---

### Step 3: Monitor Build and Deployment Logs
Render will display build logs in the dashboard:
```
==> Cloning from https://github.com/ruthvik-08/SDC-project...
==> Installing dependencies with pip install -r requirements.txt...
==> Running 'uvicorn backend.main:app --host 0.0.0.0 --port $PORT'...
INFO:     Started server process [51]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
==> Your service is live 🎉 at https://krishijal-decision-support.onrender.com
```

---

### Step 4: Verify Render Cloud Deployment
Once deployment shows `Live`:
- **Web App:** `https://<service-name>.onrender.com/app/`
- **Swagger UI:** `https://<service-name>.onrender.com/docs`
- **Health Check:** `https://<service-name>.onrender.com/health`
- **POST Predict:** `POST https://<service-name>.onrender.com/predict`

*Note on Free Tier Inactivity:*  
On Render's free tier, the service automatically spins down after 15 minutes of inactivity. The first request after spin-down may take ~30–45 seconds to wake up. Subsequent requests respond in < 15 milliseconds.

---

## 5. Verification Commands (CLI Testing)

You can verify any active deployment (Local, Ngrok, or Render) using these `curl` commands:

### A. Health Check
```bash
# Replace URL with your active deployment target:
curl -s https://postnasal-elated-clapped.ngrok-free.dev/health
# Or Render:
# curl -s https://krishijal-decision-support.onrender.com/health
```

### B. Live ML Prediction (POST /predict with 14 Features)
```bash
curl -X POST https://postnasal-elated-clapped.ngrok-free.dev/predict \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 32.0,
    "temp_max": 38.0,
    "temp_min": 24.0,
    "rainfall": 0.0,
    "humidity": 45.0,
    "effective_soil_wetness": 0.35,
    "solar_radiation": 21.0,
    "soil_ph": 7.5,
    "soil_organic_carbon": 0.45,
    "crop_type": "Cotton",
    "growth_stage": "Reproductive"
  }'
```

### C. Live ML Prediction (POST /predict with 9 Legacy Features)
```bash
curl -X POST https://postnasal-elated-clapped.ngrok-free.dev/predict \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 30.0,
    "rainfall": 0.0,
    "humidity": 50.0,
    "effective_soil_wetness": 0.40,
    "ndvi": 0.60,
    "et0": 4.80,
    "etc": 5.20,
    "cwsi": 0.35,
    "water_deficit": 1.50
  }'
```

### D. Verify Strict HTTP Method Enforcement (GET /predict yields 405)
```bash
curl -I https://postnasal-elated-clapped.ngrok-free.dev/predict
# Expected response header:
# HTTP/2 405 Method Not Allowed
```

---

## 6. Troubleshooting & Common Pitfalls

| Problem | Cause | Exact Fix |
|:---|:---|:---|
| `ERR_NGROK_4018: authentication failed` | Ngrok authtoken not registered on machine. | Run `ngrok config add-authtoken <TOKEN>` with raw token from dashboard. |
| `502 Bad Gateway` on Ngrok URL | Ngrok forwarded to wrong port (e.g. port 80). | Launch Ngrok targeting port 8000: `ngrok http 8000`. |
| Port 8000 Already in Use | Previous server process still running in background. | Run `lsof -i :8000` to find the PID, then `kill <PID>`. |
| `405 Method Not Allowed` on `/predict` | Opening `/predict` directly in web browser sends a `GET` request. | `/predict` is strictly a `POST` endpoint. Test via Swagger at `/docs` or via `curl -X POST`. |
| Render Build Fails on Dependencies | Library version conflicts. | Ensure Python version is pinned to `3.11.9` in Render environment settings. |
| Slow first request on Render (~45 sec) | Render free instance spun down due to 15 min inactivity. | Expected free tier behavior. Subsequent requests are fast (< 15 ms). |
