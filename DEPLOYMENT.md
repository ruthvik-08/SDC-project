# Deployment & Operations Guide

## Crop Stress & Irrigation Priority Decision Support System (KrishiJal)

This guide covers running **KrishiJal** locally on macOS/Windows/Linux with MySQL, sharing via Ngrok, and deploying to **Render** (`render.yaml`).

---

## 1. Local Development Setup

### Prerequisites
- **Python 3.11+**
- **MySQL 8.0** (running locally on port `3306` if using Farmer Records & prediction history)

### Step 1: Install Runtime Dependencies
```bash
git clone https://github.com/ruthvik-08/SDC-project.git
cd SDC-project
pip install -r requirements.txt
```
*(Optional: If you want to execute [notebooks/krishijal_complete_pipeline.ipynb](notebooks/krishijal_complete_pipeline.ipynb) locally in Jupyter, run `pip install -r requirements-notebook.txt`.)*

### Step 2: Configure MySQL Database
Initialize the 6 normalized tables in MySQL using [database/crop_stress_db.sql](database/crop_stress_db.sql):
```bash
mysql -u root -p < database/crop_stress_db.sql
```
Create a local `.env` file from [`.env.example`](.env.example) (`.env` is excluded via [`.gitignore`](.gitignore) and must never be committed):
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password_here
MYSQL_DATABASE=crop_stress_db
```

### Step 3: Start the Application Server
```bash
python3 run_local.py
```
This launches Uvicorn (`main:app` -> `backend/main.py`) on `http://127.0.0.1:8000`:

| URL | Description |
| :--- | :--- |
| `http://127.0.0.1:8000/app/` | 6-Module Agricultural Intelligence Portal |
| `http://127.0.0.1:8000/app/#/map` | Geospatial Map |
| `http://127.0.0.1:8000/app/#/predictor` | ML Crop Stress & Irrigation Predictor |
| `http://127.0.0.1:8000/app/#/ranking` | Irrigation Priority Rankings |
| `http://127.0.0.1:8000/app/#/benchmarks` | Kaggle Version 5 ML Benchmarks |
| `http://127.0.0.1:8000/app/#/clusters` | Agro-Climatic Clusters & PCA View |
| `http://127.0.0.1:8000/app/#/farmers` | Farmer Records & Prediction History (MySQL CRUD) |
| `http://127.0.0.1:8000/docs` | Interactive Swagger API Documentation |
| `http://127.0.0.1:8000/health` | API & Loaded `.pkl` Model Status |
| `http://127.0.0.1:8000/api/db/health` | MySQL Connectivity Status |

---

## 2. Cloud Deployment on Render

The repository includes [render.yaml](render.yaml) configured for Python `3.11.9`:

```yaml
services:
  - type: web
    name: krishijal-decision-support
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.9
    healthCheckPath: /health
    autoDeploy: true
```

### Why Root Symlinks Exist
Root symlink `main.py -> backend/main.py` alongside `backend/data`, `backend/frontend`, and `backend/models` ensures `uvicorn main:app` resolves the dataset, static frontend (`frontend/`), and serialized models (`models/saved_models/*.pkl`) reliably regardless of working directory.

### Optional Cloud MySQL on Render
ML inference (`/predict`, `/api/predict/crop-stress`), district analytics, and maps operate independently even if MySQL is not attached (`GET /api/db/health` returns `connected: false` cleanly).  
To enable **Farmer Records CRUD** in production on Render, provision a managed MySQL instance (e.g., Aiven, Railway, PlanetScale/AWS RDS), load `database/crop_stress_db.sql`, and add these environment variables in the Render dashboard:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

---

## 3. Sharing Locally via Ngrok (Demo Mode)
1. Start the local server: `python3 run_local.py`
2. Open a second terminal and run:
   ```bash
   ngrok http 8000
   ```
3. Open `<ngrok-url>/app/` in any browser or test routes via [postman/KrishiJal_Postman_Collection.json](postman/KrishiJal_Postman_Collection.json).

---

## 4. Verification Before Submission / Release

Run the full automated verification suite (`tests/test_project.py`):
```bash
python3 tests/test_project.py
```
This verifies dataset integrity (`data/processed/krishijal_master_dataset.csv`), agronomic bounds, loaded `.pkl` models, prediction bounds, REST endpoints, Kaggle Version 5 benchmark parity (`/api/models/evaluation`), MySQL CRUD round-trip (when local MySQL is active), and active 6-module frontend assets.
