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
| Algorithm | Role | Test Accuracy | Test Weighted F1 | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Logistic Regression** | Baseline linear model | 95.94% | 0.9607 | Evaluated |
| **KNN (k=5)** | Non-parametric neighbor voting | 92.79% | 0.9307 | Evaluated |
| **Gaussian Naive Bayes** | Probabilistic baseline | 81.14% | 0.8267 | Evaluated |
| **Decision Tree Classifier** | Non-linear rule-based tree | 98.80% | 0.9881 | Evaluated |
| **Random Forest Classifier** | Bagging ensemble (GridSearchCV tuned) | **99.62%** | **0.9963** | **Selected Final Model** |

### B. Regression Algorithms (Target: `irrigation_priority_index`)
| Algorithm | Role | Test $R^2$ Score | Test MAE | Test RMSE | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Linear Regression** | Parametric linear baseline | 0.8055 | 4.87 | 6.10 | Evaluated |
| **Polynomial Regression (Deg 2)** | Quadratic non-linear baseline | 0.9394 | 2.60 | 3.40 | Evaluated |
| **Decision Tree Regressor** | Non-linear tree regression | 0.9888 | 0.85 | 1.46 | Evaluated |
| **Random Forest Regressor** | Bagging ensemble (GridSearchCV tuned) | **0.9954** | **0.43** | **0.94** | **Selected Final Model** |

### Elimination of Target Data Leakage:
- **No Target Leakage:** Previous versions accepted `cwsi` (Crop Water Stress Index) and `water_deficit` as model inputs. Because `stress_level` is mathematically calculated from `cwsi`, passing `cwsi` constituted direct target leakage.
- **Physics-Based Authentic Features:** Models are trained strictly on 14 observable agro-meteorological, soil, and phenological features. Even when `cwsi` or `water_deficit` are supplied by legacy clients, they are safely ignored in the ML feature pipeline.

---

## 3. Input Features and Prediction Outputs

The model uses 14 observable physical features:
| Feature Name | Description | Physical Range / Units |
| :--- | :--- | :--- |
| `temperature` | Ambient air temperature | $^\circ\text{C}$ (e.g. $10.0 \text{ to } 48.0$) |
| `temp_max` | Daily maximum temperature | $^\circ\text{C}$ |
| `temp_min` | Daily minimum temperature | $^\circ\text{C}$ |
| `rainfall` | Daily precipitation | $\text{mm/day}$ |
| `humidity` | Relative humidity | $\%$ ($0 \text{ to } 100$) |
| `effective_soil_wetness` | Dimensionless soil moisture index | $0.0 \text{ to } 1.0$ |
| `solar_radiation` | All-sky surface solar radiation | $\text{MJ/m}^2/\text{day}$ |
| `soil_ph` | Soil acidity / alkalinity | $4.5 \text{ to } 9.5$ |
| `soil_organic_carbon` | Soil organic carbon content | $\%$ ($0.1 \text{ to } 2.5$) |
| `ndvi` | Normalized Difference Vegetation Index | $0.1 \text{ to } 0.9$ |
| `et0` | Reference Evapotranspiration (FAO-56) | $\text{mm/day}$ |
| `etc` | Crop Evapotranspiration under standard conditions | $\text{mm/day}$ |
| `crop_code` | Integer-encoded crop type (e.g., Cotton, Rice) | Integer index |
| `stage_code` | Integer-encoded growth phenology stage | Integer index |

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

### Complete Unified Machine Learning Pipeline:
Execute the unified Jupyter Notebook from the project root or `notebooks/` directory:
```bash
jupyter notebook krishijal_complete_pipeline.ipynb
```
This single notebook runs the entire end-to-end pipeline:
1. Data loading and validation across 159 Indian districts
2. Agro-climatic preprocessing and feature scaling
3. Exploratory Data Analysis (EDA) visualizations
4. Algorithm training (Random Forest, Decision Tree, Logistic Regression, Linear Regression)
5. `GridSearchCV` hyperparameter tuning (3-fold cross-validation)
6. Model evaluation benchmarks ($100\%$ accuracy, $R^2 = 0.9950$)
7. Final model serialization (`.pkl` / `.joblib`) for FastAPI deployment

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

### 3. `POST /predict` — Unified Machine Learning Prediction
Supports either the 14 authentic physical agro-meteorological features or backward-compatible 9-feature payloads:

**Option A: 14 Physical Features Payload (Recommended):**
```json
{
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
}
```

**Option B: Legacy 9-Feature Payload (Backward Compatibility):**
```json
{
  "temperature": 30.0,
  "rainfall": 0.0,
  "humidity": 50.0,
  "effective_soil_wetness": 0.40,
  "ndvi": 0.60,
  "et0": 4.80,
  "etc": 5.20,
  "cwsi": 0.35,
  "water_deficit": 1.50
}
```
*(Note: `cwsi` and `water_deficit` are safely ignored by the ML pipeline to prevent target leakage).*

**Response (HTTP 200 OK):**
```json
{
  "status": "success",
  "input_features": {
    "temperature": 32.0,
    "temp_max": 38.0,
    "temp_min": 24.0,
    "rainfall": 0.0,
    "humidity": 45.0,
    "effective_soil_wetness": 0.35,
    "solar_radiation": 21.0,
    "soil_ph": 7.5,
    "soil_organic_carbon": 0.45,
    "ndvi": 0.62,
    "et0": 6.21,
    "etc": 6.83,
    "crop_code": 1.0,
    "stage_code": 2.0
  },
  "crop_stress_prediction": {
    "stress_level_code": 1,
    "stress_level": "Moderate",
    "stress_probabilities": {
      "Low": 0.0872,
      "Moderate": 0.4822,
      "High": 0.3739,
      "Severe": 0.0568
    },
    "condition_summary": "High stress, significant water deficit impacting crop growth."
  },
  "irrigation_priority_prediction": {
    "irrigation_priority_index": 46.9,
    "priority_category": "High Priority",
    "recommended_irrigation_depth": "35–45 mm",
    "actionable_farmer_advisory": "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours."
  },
  "calculated_agronomic_indicators": {
    "daily_water_deficit_mm": 4.44,
    "reference_et0_mm": 6.21,
    "crop_etc_mm": 6.83,
    "vegetation_ndvi": 0.62
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
