# 🌾 KrishiJal: Crop Stress and Irrigation Priority Decision Support System
### *Local & Public Deployment Using FastAPI, Scikit-Learn, and Ngrok*
**First-Year B.Tech Academic Project | Faculty Deployment Standard**  
**Repository:** [https://github.com/ruthvik-08/SDC-project.git](https://github.com/ruthvik-08/SDC-project.git)

---

## 1. Project Overview
In India, agriculture sustains over 55% of the national population, but farmers routinely face extreme water scarcity, unpredictable dry spells, and depleting groundwater aquifers. The **Crop Stress and Irrigation Priority Decision Support System (KrishiJal)** is an end-to-end Machine Learning solution designed to help farmers detect plant water stress early and understand exactly where and when irrigation water must be applied.

The project combines authentic agro-meteorological observations from **NASA POWER**, satellite canopy indices (**NDVI**), United Nations **FAO-56 Penman-Monteith** crop water physics, and Government of India **Soil Health Card (SHC)** data.

### Key Capabilities:
1. **Crop Water Stress Classification:** Predicts crop stress into 4 severity classes (*Low, Moderate, High, Severe*).
2. **Irrigation Priority Index Regression:** Predicts a continuous score from **0.0 to 100.0** indicating irrigation urgency.
3. **Actionable Farmer Advisory:** Generates exact irrigation depth recommendations (e.g., *45–55 mm within 24–48 hours*) to prevent permanent crop damage.
4. **FastAPI & Public Ngrok Deployment:** High-performance REST API with interactive Swagger UI and public HTTPS tunneling.

---

## 2. Machine Learning Algorithms Used

To avoid unnecessary complexity, we selected the smallest set of relevant algorithms strictly from **Scikit-learn**:

### A. Classification Algorithms (Target: `stress_level`)
| Algorithm | Role | Test Accuracy | Status |
| :--- | :--- | :--- | :--- |
| **Logistic Regression** | Baseline linear model | 91.21% | Evaluated |
| **Decision Tree Classifier** | Non-linear rule-based tree | 99.47% | Evaluated |
| **Random Forest Classifier** | Bagging ensemble (100 estimators) | **100.0%** (Tuned) | **Selected Final Model** |

### B. Regression Algorithms (Target: `irrigation_priority_index`)
| Algorithm | Role | Test $R^2$ Score | Test MAE | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Linear Regression** | Parametric linear baseline | 0.9421 | 3.12 | Evaluated |
| **Decision Tree Regressor** | Non-linear tree regression | 0.9884 | 1.15 | Evaluated |
| **Random Forest Regressor** | Bagging ensemble ($N=80$, Depth=8) | **0.9950** (Tuned) | **0.45** | **Selected Final Model** |

### Why Random Forest Was Selected:
- **Zero Variance & Overfitting:** Averages predictions across multiple decision trees to generalize reliably on unseen weather patterns.
- **Handles Non-Linear Agronomic Interactions:** Captures complex multi-variable relationships between soil wetness, temperature, and crop evapotranspiration.
- **Physical Consistency:** Accurately respects agronomic boundaries without producing negative priority scores or out-of-bound stress levels.

---

## 3. Input Features and Prediction Outputs

The model uses 9 predictive agronomic features:
| Feature Name | Description | Physical Range / Units |
| :--- | :--- | :--- |
| `cwsi` | Crop Water Stress Index ($1 - ET_a/ET_c$) | $0.0 \text{ to } 1.0$ |
| `effective_soil_wetness` | Combined root-zone and surface soil moisture | $0.0 \text{ to } 1.0$ |
| `water_deficit` | Crop evapotranspiration water deficit | $\text{mm/day}$ |
| `ndvi` | Normalized Difference Vegetation Index | $-0.1 \text{ to } 1.0$ |
| `et0` | Reference Evapotranspiration (FAO-56) | $\text{mm/day}$ |
| `etc` | Crop Evapotranspiration under standard conditions | $\text{mm/day}$ |
| `temperature` | Mean air temperature | $^\circ\text{C}$ |
| `rainfall` | Precipitation / rainfall | $\text{mm/day}$ |
| `humidity` | Relative humidity | $\%$ |

---

## 4. Installation Commands

In compliance with the faculty document (*Local and Public Deployment Using FastAPI.docx*), install the required dependencies:

```bash
# Clone the repository
git clone https://github.com/ruthvik-08/SDC-project.git
cd SDC-project

# Install required libraries
python3 -m pip install pandas numpy scikit-learn joblib fastapi uvicorn pydantic
```

Or install directly using the backend requirements file:
```bash
pip install -r backend/requirements.txt
```

---

## 5. Model Training & Persistence Instructions

The models can be trained or re-evaluated using the Jupyter Notebooks or modular training scripts:

### Option A: Using the Complete Unified Jupyter Notebook
Open and execute:
```bash
jupyter notebook krishijal_complete_pipeline.ipynb
```
*Cell 40 saves the final tuned models into `models/saved_models/`:*
- `crop_stress_classifier.pkl` / `crop_stress_classifier.joblib`
- `irrigation_priority_regressor.pkl` / `irrigation_priority_regressor.joblib`
- `feature_scaler.pkl` / `feature_scaler.joblib`
- `model_metadata.json`

### Option B: Using the Modular Notebooks
Navigate to `notebooks/`:
- `01_data_exploration.ipynb`
- `02_data_preprocessing.ipynb`
- `03_eda.ipynb`
- `04_model_training.ipynb`
- `05_model_evaluation.ipynb`
- `06_predictions_and_model_saving.ipynb`

---

## 6. FastAPI Backend Architecture

The backend is built using **FastAPI** and located in `backend/`:
- **`backend/main.py`**: High-performance REST API server.
- **`backend/requirements.txt`**: Minimal, faculty-approved dependency specification.
- **Startup Model Loading:** Pre-trained `.pkl` / `.joblib` models are loaded into RAM once when the server boots. **Models are never retrained per request**, ensuring response times under 10 milliseconds.
- **Data Validation with Pydantic:** The `PredictRequest` schema validates data types and rejects invalid or incomplete JSON payloads with HTTP 422 errors.

---

## 7. Local Deployment Instructions

### Method 1: Using the Pre-configured Runner (Recommended)
From the project root:
```bash
python3 run_local.py
```

### Method 2: Running Uvicorn Directly
From the `backend/` directory:
```bash
cd backend
python3 -m uvicorn main:app --reload --port 8000
```
Or from the root directory:
```bash
python3 -m uvicorn backend.main:app --reload --port 8000
```

### Local URLs:
| Service | Local URL |
| :--- | :--- |
| **API Root Information** | [http://127.0.0.1:8000/](http://127.0.0.1:8000/) |
| **Health Check** | [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) |
| **Interactive Swagger UI Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **Alternative ReDoc** | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) |
| **Prediction Endpoint** | `POST http://127.0.0.1:8000/predict` |

---

## 8. API Endpoints Specification

### 1. `GET /` — Project Information
**Response:**
```json
{
  "project": "Crop Stress and Irrigation Priority Decision Support System (KrishiJal)",
  "project_name": "KrishiJal Decision Support System",
  "description": "Machine Learning-based decision support system helping Indian farmers identify crop water stress and optimize irrigation scheduling.",
  "primary_stakeholders": "Farmers",
  "status": "Online and Operational",
  "version": "2.1.0",
  "api_documentation": "/docs"
}
```

### 2. `GET /health` — Service & Model Health Check
**Response:**
```json
{
  "status": "healthy",
  "api_operational": true,
  "models_loaded": {
    "crop_stress_classifier": true,
    "irrigation_priority_regressor": true
  },
  "model_types": {
    "classification": "RandomForestClassifier",
    "regression": "RandomForestRegressor"
  }
}
```

### 3. `POST /predict` — Live Machine Learning Prediction
**Request Body (JSON):**
```json
{
  "cwsi": 0.35,
  "effective_soil_wetness": 0.40,
  "water_deficit": 1.50,
  "ndvi": 0.60,
  "et0": 4.80,
  "etc": 5.20,
  "temperature": 30.0,
  "rainfall": 0.0,
  "humidity": 50.0
}
```

**Response (HTTP 200 OK):**
```json
{
  "status": "success",
  "input_features": {
    "cwsi": 0.35,
    "effective_soil_wetness": 0.4,
    "water_deficit": 1.5,
    "ndvi": 0.6,
    "et0": 4.8,
    "etc": 5.2,
    "temperature": 30.0,
    "rainfall": 0.0,
    "humidity": 50.0
  },
  "crop_stress_prediction": {
    "stress_level_code": 1,
    "stress_level": "Moderate",
    "stress_probabilities": {
      "Low": 0.0,
      "Moderate": 0.5169,
      "High": 0.4831,
      "Severe": 0.0
    },
    "condition_summary": "Mild to moderate stress, early signs of water limitation."
  },
  "irrigation_priority_prediction": {
    "irrigation_priority_index": 22.8,
    "priority_category": "Low Priority",
    "recommended_irrigation_depth": "Routine / Nil",
    "actionable_farmer_advisory": "ADEQUATE: Moisture levels optimal. Continue standard crop monitoring."
  },
  "models_used": {
    "classifier": "Tuned RandomForestClassifier (.pkl)",
    "regressor": "Tuned RandomForestRegressor (.pkl)"
  }
}
```

---

## 9. Postman Testing Instructions

A ready-to-use Postman Collection is provided in `postman/KrishiJal_Postman_Collection.json`.

### How to Import & Test:
1. Open **Postman**.
2. Click **Import** &rarr; select `postman/KrishiJal_Postman_Collection.json`.
3. The collection includes a `{{base_url}}` variable (defaults to `http://127.0.0.1:8000`).

### Test Cases Included:
1. **Valid Prediction (HTTP 200 OK):**
   - Method: `POST`
   - URL: `{{base_url}}/predict`
   - Sends complete JSON body with all 9 features.
   - Verifies real-time predictions for crop stress and irrigation priority.
2. **Missing Inputs Test (HTTP 422 Unprocessable Entity):**
   - Sends incomplete JSON (omitting `effective_soil_wetness`).
   - Verifies that FastAPI/Pydantic returns a validation error identifying missing fields.
3. **Invalid Data Type Test (HTTP 422 Unprocessable Entity):**
   - Sends `"cwsi": "not_a_number"`.
   - Verifies that Pydantic rejects non-numeric inputs.

---

## 10. Public Deployment Using Ngrok

To share your API publicly with faculty or external reviewers via a secure HTTPS tunnel, follow the instructions from the faculty document:

### Step 1: Install Ngrok
*On macOS (Homebrew already installed):*
```bash
brew install --cask ngrok
```

### Step 2: Configure Your Personal Ngrok AuthToken
1. Sign up for a free account at [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup).
2. Copy your AuthToken from [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
3. Authenticate your local machine (*never share or commit your token*):
```bash
ngrok config add-authtoken <YOUR_PERSONAL_AUTHTOKEN>
```

### Step 3: Start the Local FastAPI Backend (Terminal 1)
```bash
python3 run_local.py
```

### Step 4: Start the Ngrok Tunnel (Terminal 2)
```bash
ngrok http 8000
```

Ngrok will display output similar to:
```
Forwarding                    https://abc1-23-45-67.ngrok-free.app -> http://localhost:8000
```

### Step 5: Verify the Public HTTPS Endpoints
Replace `http://127.0.0.1:8000` with your public ngrok URL:
- **Public API Root:** `https://<your-id>.ngrok-free.app/`
- **Public Health Check:** `https://<your-id>.ngrok-free.app/health`
- **Public Swagger UI Docs:** `https://<your-id>.ngrok-free.app/docs`
- **Public Prediction Endpoint:** `POST https://<your-id>.ngrok-free.app/predict`

In Postman, set the collection variable `base_url` to `https://<your-id>.ngrok-free.app` to test the public deployment with a single click!

---

## 11. Automated Test Suite Verification

To verify all system components, data bounds, model serialization, and API endpoints:
```bash
python3 tests/test_project.py
```
**Results:** 8/8 test stages pass with 100% pass rate.

---

*Academic Machine Learning Project Developed by First-Year B.Tech Student.*
