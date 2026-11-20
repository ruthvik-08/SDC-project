"""
==============================================================================
KRISHIJAL: ALL-INDIA CROP STRESS & IRRIGATION PRIORITY DECISION SUPPORT SYSTEM
FastAPI Production Backend (Academic Evaluation Grade)
Target Users: Indian Farmers, District Agricultural Officers, Policy Planners
==============================================================================
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Scikit-learn models and transformers
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline

# ------------------------------------------------------------------------------
# 1. DIRECTORY & FILE PATH CONFIGURATION (ROBUST PATH RESOLUTION)
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "models"
SAVED_MODELS_DIR = MODELS_DIR / "saved_models"
FRONTEND_DIR = BASE_DIR / "frontend"
METRICS_PATH = BASE_DIR / "backend" / "model_evaluation_metrics.json"

# Master dataset path
master_dataset_path = DATA_DIR / "krishijal_master_dataset.csv"
if not master_dataset_path.exists():
    master_dataset_path = BASE_DIR / "krishijal_master_dataset.csv"

# Load master dataset
if not master_dataset_path.exists():
    raise FileNotFoundError(f"Critical error: Master dataset not found at {master_dataset_path}")

df_master = pd.read_csv(master_dataset_path)
df_processed = df_master.copy()
df_all = df_master

# Categorical encodings
crop_categories = sorted(df_processed["crop_type"].dropna().unique().tolist())
stage_categories = sorted(df_processed["growth_stage"].dropna().unique().tolist())

crop_map = {name: idx for idx, name in enumerate(crop_categories)}
stage_map = {name: idx for idx, name in enumerate(stage_categories)}

df_processed["crop_code"] = df_processed["crop_type"].map(crop_map).fillna(0).astype(int)
df_processed["stage_code"] = df_processed["growth_stage"].map(stage_map).fillna(1).astype(int)

# Exact 14 features on which the ML models are trained
feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

X_train = df_processed[feature_cols]
y_train_class = df_processed["stress_level_code"]
y_train_deficit = df_processed["water_deficit"]
y_train_priority = df_processed["irrigation_priority_index"]

# ------------------------------------------------------------------------------
# 2. MODEL LOADING STRATEGY (PERSISTENT PRODUCTION MODELS)
# ------------------------------------------------------------------------------
models_loaded = {
    "crop_stress_classifier": False,
    "irrigation_priority_regressor": False,
    "feature_scaler": False,
    "crop_stress_decision_tree": False,
    "crop_stress_logistic_regression": False,
    "irrigation_decision_tree": False,
    "irrigation_linear_regression": False
}
model_errors = {}

def load_first_available(filenames: List[str]):
    for filename in filenames:
        for search_dir in [SAVED_MODELS_DIR, MODELS_DIR, BASE_DIR]:
            p = search_dir / filename
            if p.exists():
                try:
                    obj = joblib.load(p)
                    return obj, str(p)
                except Exception as e:
                    model_errors[filename] = str(e)
    return None, None

# Load persistent models
scaler, scaler_path = load_first_available(["feature_scaler.pkl", "feature_scaler.joblib"])
if scaler is not None:
    models_loaded["feature_scaler"] = True
else:
    scaler = StandardScaler()
    scaler.fit(X_train)
    model_errors["feature_scaler"] = "Fallback in-memory fitted StandardScaler"

X_train_scaled = scaler.transform(X_train)

# Random Forest Classifier
saved_rf_classifier, clf_path = load_first_available([
    "crop_stress_classifier.pkl", "crop_stress_classifier.joblib"
])
if saved_rf_classifier is not None:
    models_loaded["crop_stress_classifier"] = True
    model_rf = saved_rf_classifier
else:
    model_rf = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
    model_rf.fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_class)
    saved_rf_classifier = model_rf
    model_errors["crop_stress_classifier"] = "Fallback in-memory fitted RandomForestClassifier"

# Random Forest Regressor (Irrigation Priority Index)
saved_rf_regressor, reg_path = load_first_available([
    "irrigation_priority_regressor.pkl", "irrigation_priority_regressor.joblib"
])
if saved_rf_regressor is not None:
    models_loaded["irrigation_priority_regressor"] = True
    model_reg = saved_rf_regressor
else:
    model_reg = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42)
    model_reg.fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_priority)
    saved_rf_regressor = model_reg
    model_errors["irrigation_priority_regressor"] = "Fallback in-memory fitted RandomForestRegressor"

# Baseline Classifiers
saved_dt, dt_path = load_first_available(["crop_stress_decision_tree.pkl"])
if saved_dt is not None:
    models_loaded["crop_stress_decision_tree"] = True
    model_dt = saved_dt
else:
    model_dt = DecisionTreeClassifier(max_depth=6, random_state=42).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_class)

saved_lr, lr_path = load_first_available(["crop_stress_logistic_regression.pkl"])
if saved_lr is not None:
    models_loaded["crop_stress_logistic_regression"] = True
    model_logreg = saved_lr
else:
    model_logreg = LogisticRegression(max_iter=500, random_state=42).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_class)

model_knn = KNeighborsClassifier(n_neighbors=5).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_class)
model_nb = GaussianNB().fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_class)

# Baseline Regressors
saved_reg_dt, reg_dt_path = load_first_available(["irrigation_decision_tree.pkl"])
if saved_reg_dt is not None:
    models_loaded["irrigation_decision_tree"] = True
    model_reg_dt = saved_reg_dt
else:
    model_reg_dt = DecisionTreeRegressor(max_depth=6, random_state=42).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_priority)

saved_reg_lin, reg_lin_path = load_first_available(["irrigation_linear_regression.pkl"])
if saved_reg_lin is not None:
    models_loaded["irrigation_linear_regression"] = True
    model_reg_lin = saved_reg_lin
else:
    model_reg_lin = LinearRegression().fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_priority)

# Polynomial regression baselines for deficit and priority
model_poly_priority = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_priority)

model_poly_deficit = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(pd.DataFrame(X_train_scaled, columns=feature_cols), y_train_deficit)

# Evaluation metrics
evaluation_metrics = {}
if METRICS_PATH.exists():
    try:
        with open(METRICS_PATH, "r") as mf:
            evaluation_metrics = json.load(mf)
    except Exception as e:
        model_errors["evaluation_metrics"] = str(e)

stress_label_map = {0: "Low", 1: "Moderate", 2: "High", 3: "Severe"}

cluster_profiles_info = {
    0: {"name": "High-Evaporation Central & Western Zone", "description": "High temperature, moderate soil moisture."},
    1: {"name": "Humid Coastal & Floodplain Belt", "description": "High relative humidity, abundant rainfall."},
    2: {"name": "Arid & Semi-Arid Moisture-Deficit Belt", "description": "Low rainfall, sandy soils, high water stress."},
    3: {"name": "Cool Mountain & Sub-Himalayan Plateau", "description": "Lower temperature, mountain soils, stable moisture."}
}

# ------------------------------------------------------------------------------
# 3. INITIALIZE FASTAPI APP & MIDDLEWARE
# ------------------------------------------------------------------------------
app = FastAPI(
    title="KrishiJal - All-India Crop Stress & Irrigation Priority System",
    description="Machine Learning decision support system for agricultural water conservation across Indian agro-climatic zones.",
    version="2.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# 4. ROBUST FEATURE RECONSTRUCTION (PREVENTS TARGET DATA LEAKAGE)
# ------------------------------------------------------------------------------
def reconstruct_14_features(data: Dict[str, Any]) -> pd.DataFrame:
    """
    Constructs the exact 14 physical agro-meteorological features required by the models.
    FAO-56 Penman-Monteith & Hargreaves physical equations are used when secondary inputs are omitted.
    Crucially, target variables (cwsi, water_deficit) are NEVER passed to the ML models.
    """
    raw_temp = data.get("temperature") if data.get("temperature") is not None else data.get("temperature_c")
    temp = float(raw_temp) if raw_temp is not None else 30.0

    raw_tmax = data.get("temp_max")
    temp_max = float(raw_tmax) if raw_tmax is not None else round(temp + 5.5, 1)

    raw_tmin = data.get("temp_min")
    temp_min = float(raw_tmin) if raw_tmin is not None else round(temp - 5.5, 1)

    raw_rain = data.get("rainfall") if data.get("rainfall") is not None else data.get("rainfall_mm")
    rain = float(raw_rain) if raw_rain is not None else 0.0

    raw_hum = data.get("humidity") if data.get("humidity") is not None else data.get("humidity_pct")
    hum = float(raw_hum) if raw_hum is not None else 50.0

    raw_soil = data.get("effective_soil_wetness") if data.get("effective_soil_wetness") is not None else data.get("soil_moisture")
    soil = float(raw_soil) if raw_soil is not None else 0.40

    # Solar radiation (MJ/m^2/day): Hargreaves formula estimate if not provided
    if data.get("solar_radiation") is not None:
        solar = float(data["solar_radiation"])
    else:
        delta_t = max(temp_max - temp_min, 1.0)
        solar = round(float(0.16 * np.sqrt(delta_t) * 28.0), 1)

    soil_ph = float(data["soil_ph"]) if data.get("soil_ph") is not None else 7.4
    soil_soc = float(data["soil_organic_carbon"]) if data.get("soil_organic_carbon") is not None else 0.48

    # NDVI: Agronomic estimate from soil wetness if not provided
    if data.get("ndvi") is not None:
        ndvi = float(data["ndvi"])
    else:
        ndvi = round(float(np.clip(0.55 + (soil * 0.20), 0.15, 0.88)), 3)

    # Reference Evapotranspiration (ET0) using Hargreaves formula if not provided
    if data.get("et0") is not None:
        et0 = float(data["et0"])
    else:
        delta_t = max(temp_max - temp_min, 1.0)
        et0 = round(float(0.0023 * (temp + 17.8) * np.sqrt(delta_t) * 14.5), 2)

    # Crop Evapotranspiration (ETc = ET0 * Kc)
    if data.get("etc") is not None:
        etc = float(data["etc"])
    else:
        etc = round(float(et0 * 1.10), 2)

    # Crop and Growth Stage encoding
    c_type = data.get("crop_type") or "Cotton"
    g_stage = data.get("growth_stage") or "Reproductive"
    
    raw_crop_code = data.get("crop_code")
    crop_code = int(raw_crop_code) if raw_crop_code is not None else int(crop_map.get(c_type, 0))
    
    raw_stage_code = data.get("stage_code")
    stage_code = int(raw_stage_code) if raw_stage_code is not None else int(stage_map.get(g_stage, 1))

    row_dict = {
        "temperature": temp,
        "temp_max": temp_max,
        "temp_min": temp_min,
        "rainfall": rain,
        "humidity": hum,
        "effective_soil_wetness": soil,
        "solar_radiation": solar,
        "soil_ph": soil_ph,
        "soil_organic_carbon": soil_soc,
        "ndvi": ndvi,
        "et0": et0,
        "etc": etc,
        "crop_code": crop_code,
        "stage_code": stage_code
    }
    return pd.DataFrame([row_dict], columns=feature_cols)

# ------------------------------------------------------------------------------
# 5. REST API SCHEMAS
# ------------------------------------------------------------------------------
class PredictRequest(BaseModel):
    temperature: float = Field(default=30.0, description="Ambient temperature (°C)")
    rainfall: float = Field(default=0.0, description="Daily rainfall (mm)")
    humidity: float = Field(default=50.0, description="Relative humidity (%)")
    effective_soil_wetness: float = Field(default=0.40, description="Effective soil wetness index (0 to 1)")
    temp_max: Optional[float] = Field(default=None, description="Maximum temperature (°C)")
    temp_min: Optional[float] = Field(default=None, description="Minimum temperature (°C)")
    solar_radiation: Optional[float] = Field(default=None, description="Solar radiation (MJ/m²/day)")
    soil_ph: Optional[float] = Field(default=None, description="Soil pH level")
    soil_organic_carbon: Optional[float] = Field(default=None, description="Soil Organic Carbon (%)")
    ndvi: Optional[float] = Field(default=None, description="Normalized Difference Vegetation Index (0 to 1)")
    et0: Optional[float] = Field(default=None, description="Reference evapotranspiration (mm/day)")
    etc: Optional[float] = Field(default=None, description="Crop evapotranspiration (mm/day)")
    crop_type: Optional[str] = Field(default="Cotton", description="Crop variety")
    growth_stage: Optional[str] = Field(default="Reproductive", description="Growth phenological stage")
    crop_code: Optional[int] = Field(default=None, description="Integer encoded crop code")
    stage_code: Optional[int] = Field(default=None, description="Integer encoded stage code")
    # Legacy fields (accepted for backward compatibility, safely ignored in ML feature matrix to prevent data leakage)
    cwsi: Optional[float] = Field(default=None, description="Crop Water Stress Index (target variable)")
    water_deficit: Optional[float] = Field(default=None, description="Daily water deficit (mm)")

    model_config = {
        "json_schema_extra": {
            "example": {
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
        }
    }

class CropStressSimRequest(BaseModel):
    temperature: float = 32.5
    temperature_c: Optional[float] = 32.5
    temp_max: Optional[float] = 38.0
    temp_min: Optional[float] = 24.0
    rainfall: float = 0.5
    rainfall_mm: Optional[float] = 0.5
    humidity: float = 45.0
    humidity_pct: Optional[float] = 45.0
    effective_soil_wetness: float = 0.38
    soil_moisture: Optional[float] = 0.38
    solar_radiation: Optional[float] = 21.0
    soil_ph: Optional[float] = 7.5
    soil_organic_carbon: Optional[float] = 0.45
    crop_type: Optional[str] = "Cotton"
    growth_stage: Optional[str] = "Reproductive"
    selected_model: Optional[str] = "Random Forest"

class IrrigationPriorityRequest(BaseModel):
    temperature: float = 30.0
    rainfall: float = 0.0
    humidity: float = 50.0
    effective_soil_wetness: float = 0.40
    cwsi: Optional[float] = 0.35
    water_deficit: Optional[float] = 1.50
    ndvi: Optional[float] = 0.60
    et0: Optional[float] = 4.80
    etc: Optional[float] = 5.20

# ------------------------------------------------------------------------------
# 6. REST API ENDPOINTS
# ------------------------------------------------------------------------------

@app.get("/", summary="Root System Status")
def get_root():
    """Returns application metadata, stakeholder information, and available API routes."""
    return {
        "project": "Crop Stress and Irrigation Priority Decision Support System (KrishiJal)",
        "project_name": "KrishiJal Decision Support System",
        "description": "Machine Learning-based decision support system helping Indian farmers identify crop water stress and optimize irrigation scheduling.",
        "primary_stakeholders": "Farmers",
        "status": "Online and Operational",
        "version": "2.2.0",
        "api_documentation": "/docs",
        "alternative_documentation": "/redoc",
        "endpoints": {
            "root": "GET /",
            "health_check": "GET /health",
            "prediction": "POST /predict",
            "crop_stress_api": "POST /api/predict/crop-stress",
            "irrigation_priority_api": "POST /api/predict/irrigation-priority",
            "districts_data": "GET /api/districts",
            "regional_clusters": "GET /api/clusters/regions",
            "irrigation_priority_table": "GET /api/irrigation/priority",
            "model_evaluation": "GET /api/models/evaluation"
        },
        "features_required_for_predict": feature_cols,
        "models_active": {
            "classification": "Tuned RandomForestClassifier (.pkl)",
            "regression": "Tuned RandomForestRegressor (.pkl)"
        },
        "total_records": len(df_all),
        "states_covered": int(df_all["state"].nunique()),
        "districts_covered": int(df_all["district"].nunique()),
        "web_app": "/app/"
    }

@app.get("/health", summary="System & ML Model Health Check")
def get_health():
    """Reports exact model loading state, pipeline readiness, and master dataset statistics."""
    core_models_ok = (
        models_loaded["crop_stress_classifier"] and
        models_loaded["irrigation_priority_regressor"] and
        models_loaded["feature_scaler"]
    )
    return {
        "status": "healthy" if core_models_ok else "degraded",
        "api_operational": True,
        "models_loaded": models_loaded,
        "model_errors": model_errors,
        "model_types": {
            "classification": type(saved_rf_classifier).__name__,
            "regression": type(saved_rf_regressor).__name__,
            "scaler": type(scaler).__name__
        },
        "features_required": feature_cols,
        "dataset_records": len(df_all),
        "districts_covered": int(df_all["district"].nunique()),
        "states_covered": int(df_all["state"].nunique())
    }

@app.post("/predict", summary="Unified ML Prediction Endpoint")
def predict_stress_and_priority(item: PredictRequest):
    """
    Main prediction endpoint. Accepts 14-feature or legacy 9-feature payloads,
    reconstructs missing FAO-56 physical metrics, applies standard scaling,
    and returns comprehensive crop stress and irrigation priority advisories.
    """
    try:
        raw_df = reconstruct_14_features(item.model_dump())
        scaled_matrix = scaler.transform(raw_df)
        scaled_df = pd.DataFrame(scaled_matrix, columns=feature_cols)

        # Classifier inference
        pred_class_code = int(saved_rf_classifier.predict(scaled_df)[0])
        pred_label = stress_label_map.get(pred_class_code, "Moderate")

        probabilities = {}
        if hasattr(saved_rf_classifier, "predict_proba"):
            probs = saved_rf_classifier.predict_proba(scaled_df)[0]
            probabilities = {
                stress_label_map.get(idx, str(idx)): round(float(p), 4)
                for idx, p in enumerate(probs)
            }

        # Regressor inference
        pred_priority = float(saved_rf_regressor.predict(scaled_df)[0])
        priority_index = round(float(np.clip(pred_priority, 0.0, 100.0)), 1)

        # Deficit calculation from physical water balance
        etc_val = float(raw_df["etc"].iloc[0])
        rain_val = float(raw_df["rainfall"].iloc[0])
        soil_val = float(raw_df["effective_soil_wetness"].iloc[0])
        calc_deficit = max(0.0, round(etc_val - (rain_val + soil_val * etc_val), 2))

        # Categorization & Advisory
        if priority_index >= 60.0:
            category = "Critical Priority"
            water_depth = "45–55 mm"
            advisory = "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required."
            condition = "Severe moisture exhaustion, immediate intervention needed."
        elif priority_index >= 45.0:
            category = "High Priority"
            water_depth = "35–45 mm"
            advisory = "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours."
            condition = "High stress, significant water deficit impacting crop growth."
        elif priority_index >= 30.0:
            category = "Medium Priority"
            water_depth = "20–30 mm"
            advisory = "MODERATE: Soil moisture depleting. Plan irrigation cycle within 3–4 days."
            condition = "Mild to moderate stress, early signs of water limitation."
        else:
            category = "Low Priority"
            water_depth = "Routine / Nil"
            advisory = "ADEQUATE: Moisture levels optimal. Continue standard crop monitoring."
            condition = "Optimal conditions, crop is healthy."

        return {
            "status": "success",
            "input_features": {col: float(raw_df[col].iloc[0]) for col in feature_cols},
            "crop_stress_prediction": {
                "stress_level_code": pred_class_code,
                "stress_level": pred_label,
                "stress_probabilities": probabilities,
                "condition_summary": condition
            },
            "irrigation_priority_prediction": {
                "irrigation_priority_index": priority_index,
                "priority_category": category,
                "recommended_irrigation_depth": water_depth,
                "actionable_farmer_advisory": advisory
            },
            "calculated_agronomic_indicators": {
                "daily_water_deficit_mm": calc_deficit,
                "reference_et0_mm": float(raw_df["et0"].iloc[0]),
                "crop_etc_mm": float(raw_df["etc"].iloc[0]),
                "vegetation_ndvi": float(raw_df["ndvi"].iloc[0])
            },
            "models_used": {
                "classifier": "Tuned RandomForestClassifier (.pkl)",
                "regressor": "Tuned RandomForestRegressor (.pkl)"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/api/predict/crop-stress", summary="Frontend Simulator Inference Endpoint")
def predict_crop_stress_sim(item: CropStressSimRequest):
    """
    Dedicated endpoint supporting the frontend interactive simulator.
    Permits selecting comparison algorithms (Random Forest, Decision Tree, Logistic Regression, KNN).
    """
    try:
        raw_df = reconstruct_14_features(item.model_dump())
        scaled_matrix = scaler.transform(raw_df)
        scaled_df = pd.DataFrame(scaled_matrix, columns=feature_cols)

        # Select model based on user choice
        selected_model_name = item.selected_model or "Random Forest"
        if "Tree" in selected_model_name:
            chosen_clf = model_dt
            model_tag = "Decision Tree Classifier"
        elif "Logistic" in selected_model_name:
            chosen_clf = model_logreg
            model_tag = "Logistic Regression"
        elif "KNN" in selected_model_name:
            chosen_clf = model_knn
            model_tag = "K-Nearest Neighbors"
        elif "Bayes" in selected_model_name:
            chosen_clf = model_nb
            model_tag = "Gaussian Naive Bayes"
        else:
            chosen_clf = saved_rf_classifier
            model_tag = "Tuned Random Forest Classifier (.pkl)"

        pred_code = int(chosen_clf.predict(scaled_df)[0])
        pred_label = stress_label_map.get(pred_code, "Low")

        # Regressor inferences
        pred_priority = float(saved_rf_regressor.predict(scaled_df)[0])
        priority_index = round(float(np.clip(pred_priority, 0.0, 100.0)), 1)

        pred_deficit = float(model_poly_deficit.predict(scaled_df)[0])
        deficit_val = round(float(np.clip(pred_deficit, 0.0, 15.0)), 2)

        if priority_index >= 50.0:
            priority_level = "High Priority"
            urgency_color = "#d62728"
            recommendation = "Severe water stress detected. Apply 35-45 mm irrigation immediately."
        elif priority_index >= 35.0:
            priority_level = "Medium Priority"
            urgency_color = "#ff7f0e"
            recommendation = "Soil moisture is declining. Prepare irrigation within 48-72 hours."
        else:
            priority_level = "Low Priority"
            urgency_color = "#2ca02c"
            recommendation = "Moisture is adequate. Continue regular monitoring."

        return {
            "crop_stress_level": pred_label,
            "crop_stress_code": pred_code,
            "model_used": model_tag,
            "predicted_water_deficit_mm_per_day": deficit_val,
            "irrigation_priority_index": priority_index,
            "irrigation_priority_level": priority_level,
            "urgency_color": urgency_color,
            "recommendation": recommendation,
            "calculated_agronomic_indicators": {
                "reference_et0_mm": float(raw_df["et0"].iloc[0]),
                "crop_etc_mm": float(raw_df["etc"].iloc[0]),
                "estimated_ndvi": float(raw_df["ndvi"].iloc[0])
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference computation error: {str(e)}")

@app.post("/api/predict/irrigation-priority", summary="Irrigation Priority Assessment Endpoint")
def predict_irrigation_priority(item: IrrigationPriorityRequest):
    """
    Dedicated endpoint for quantifying Irrigation Priority Index (0 to 100)
    and prescribing precise irrigation depths.
    """
    try:
        raw_df = reconstruct_14_features(item.model_dump())
        scaled_matrix = scaler.transform(raw_df)
        scaled_df = pd.DataFrame(scaled_matrix, columns=feature_cols)

        pred_val = float(saved_rf_regressor.predict(scaled_df)[0])
        priority_index = round(float(np.clip(pred_val, 0.0, 100.0)), 1)

        if priority_index >= 60.0:
            category = "Critical Priority"
            depth = "45–55 mm"
            advisory = "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required."
        elif priority_index >= 45.0:
            category = "High Priority"
            depth = "35–45 mm"
            advisory = "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours."
        elif priority_index >= 30.0:
            category = "Medium Priority"
            depth = "20–30 mm"
            advisory = "MODERATE: Soil wetness is depleting. Schedule irrigation in 48-72 hours."
        else:
            category = "Low Priority"
            depth = "Routine / Nil"
            advisory = "ADEQUATE: Moisture levels optimal. Continue standard monitoring."

        return {
            "irrigation_priority_index": priority_index,
            "priority_category": category,
            "recommended_irrigation_depth": depth,
            "actionable_farmer_advisory": advisory,
            "model_used": "Tuned Random Forest Regressor (.pkl)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Priority prediction error: {str(e)}")

@app.get("/api/dataset/info", summary="Dataset Agronomic Profile & Summary")
def get_dataset_info():
    """Returns descriptive statistical metrics and national coverage of the processed dataset."""
    return {
        "total_records": len(df_all),
        "total_districts": int(df_all["district"].nunique()),
        "total_states": int(df_all["state"].nunique()),
        "states_list": sorted(df_all["state"].unique().tolist()),
        "districts_list": sorted(df_all["district"].unique().tolist()),
        "crops_covered": sorted(df_all["crop_type"].unique().tolist()),
        "national_averages": {
            "mean_temperature_c": round(float(df_all["temperature"].mean()), 2),
            "mean_rainfall_mm": round(float(df_all["rainfall"].mean()), 2),
            "mean_humidity_pct": round(float(df_all["humidity"].mean()), 2),
            "mean_soil_moisture": round(float(df_all["effective_soil_wetness"].mean()), 3),
            "mean_crop_etc_mm": round(float(df_all["etc"].mean()), 2),
            "mean_irrigation_priority_index": round(float(df_all["irrigation_priority_index"].mean()), 1)
        },
        "stress_level_distribution": df_all["stress_level"].value_counts().to_dict(),
        "irrigation_priority_distribution": df_all["irrigation_priority"].value_counts().to_dict()
    }

# Precompute districts summary
districts_summary = []
for d_name, grp in df_all.groupby("district"):
    c_id = int(grp["cluster_id"].mode()[0]) if "cluster_id" in grp else 0
    c_info = cluster_profiles_info.get(c_id, {"name": "General Agricultural Zone", "description": ""})
    mean_ipi = round(float(grp["irrigation_priority_index"].mean()), 1)
    districts_summary.append({
        "district": d_name,
        "state": grp["state"].iloc[0],
        "latitude": round(float(grp["latitude"].iloc[0]), 4) if "latitude" in grp else 20.0,
        "longitude": round(float(grp["longitude"].iloc[0]), 4) if "longitude" in grp else 78.0,
        "crop_type": grp["crop_type"].iloc[0],
        "growth_stage": grp["growth_stage"].iloc[0],
        "soil_type": grp["soil_type"].iloc[0],
        "soil_ph": round(float(grp["soil_ph"].iloc[0]), 1),
        "soil_organic_carbon": round(float(grp["soil_organic_carbon"].iloc[0]), 2),
        "temperature": round(float(grp["temperature"].mean()), 1),
        "temp_max": round(float(grp["temp_max"].mean()), 1),
        "temp_min": round(float(grp["temp_min"].mean()), 1),
        "rainfall": round(float(grp["rainfall"].mean()), 1),
        "humidity": round(float(grp["humidity"].mean()), 1),
        "effective_soil_wetness": round(float(grp["effective_soil_wetness"].mean()), 2),
        "solar_radiation": round(float(grp["solar_radiation"].mean()), 1),
        "cwsi": round(float(grp["cwsi"].mean()), 3),
        "water_deficit": round(float(grp["water_deficit"].mean()), 2),
        "et0": round(float(grp["et0"].mean()), 2),
        "etc": round(float(grp["etc"].mean()), 2),
        "ndvi": round(float(grp["ndvi"].mean()), 3),
        "irrigation_priority_index": mean_ipi,
        "priority_category": "High Priority" if mean_ipi >= 50.0 else ("Medium Priority" if mean_ipi >= 35.0 else "Low Priority"),
        "stress_level": "Severe" if mean_ipi >= 60.0 else ("High" if mean_ipi >= 45.0 else ("Moderate" if mean_ipi >= 30.0 else "Low")),
        "cluster_id": c_id,
        "cluster_name": c_info["name"],
        "state_lgd_code": int(grp["state_lgd_code"].iloc[0]) if "state_lgd_code" in grp else 0,
        "district_lgd_code": int(grp["district_lgd_code"].iloc[0]) if "district_lgd_code" in grp else 0,
        "nitrogen_status": str(grp["nitrogen_status"].iloc[0]) if "nitrogen_status" in grp else "Optimal (Medium N)",
        "soil_ph_character": str(grp["soil_ph_character"].iloc[0]) if "soil_ph_character" in grp else "Neutral / Balanced",
        "soil_health_index": round(float(grp["soil_health_index"].iloc[0]), 1) if "soil_health_index" in grp else 50.0,
        "soil_nitrogen_low_share": round(float(grp["shc_macro_nitrogen_low_share_2024_25"].iloc[0]), 3) if "shc_macro_nitrogen_low_share_2024_25" in grp else 0.0,
        "soil_ph_neutral_share": round(float(grp["shc_macro_soil_ph_neutral_share_2024_25"].iloc[0]), 3) if "shc_macro_soil_ph_neutral_share_2024_25" in grp else 1.0
    })

@app.get("/api/districts", summary="All-India Districts Geospatial Directory")
def get_districts():
    """Returns geospatial agricultural attributes for all covered districts across India."""
    return {"total_districts": len(districts_summary), "districts": districts_summary}

# Precompute clusters summary
cluster_list = []
for d_name, grp in df_all.groupby("district"):
    c_id = int(grp["cluster_id"].mode()[0]) if "cluster_id" in grp else 0
    c_info = cluster_profiles_info.get(c_id, {"name": "General Zone", "description": ""})
    cluster_list.append({
        "district": d_name,
        "state": grp["state"].iloc[0],
        "crop": grp["crop_type"].iloc[0],
        "cluster_id": c_id,
        "cluster_name": c_info["name"],
        "cluster_description": c_info["description"],
        "pca_x": round(float(grp["pca_x"].mean()), 2) if "pca_x" in grp else 0.0,
        "pca_y": round(float(grp["pca_y"].mean()), 2) if "pca_y" in grp else 0.0,
        "mean_temperature": round(float(grp["temperature"].mean()), 1),
        "mean_rainfall": round(float(grp["rainfall"].mean()), 1),
        "mean_soil_moisture": round(float(grp["effective_soil_wetness"].mean()), 2),
        "mean_priority_index": round(float(grp["irrigation_priority_index"].mean()), 1)
    })

clusters_response = {
    "clusters_summary": cluster_profiles_info,
    "districts_clustered": cluster_list
}

@app.get("/api/clusters/regions", summary="Agro-Climatic Regional Clusters")
def get_clusters():
    """Returns unsupervised clustering results (K-Means and PCA 2D projections)."""
    return clusters_response

# Precompute ranked priority list
ranked_priority_list = []
for d_name, grp in df_all.groupby("district"):
    mean_ipi = round(float(grp["irrigation_priority_index"].mean()), 1)
    mean_cwsi = round(float(grp["cwsi"].mean()), 3) if "cwsi" in grp else 0.3
    mean_soil = round(float(grp["effective_soil_wetness"].mean()), 3)
    mean_rain = round(float(grp["rainfall"].mean()), 2)
    mean_deficit = round(float(grp["water_deficit"].mean()), 2) if "water_deficit" in grp else 1.5

    if mean_ipi >= 50.0:
        priority_tag = "High Priority"
        water_depth = "40–50 mm"
    elif mean_ipi >= 35.0:
        priority_tag = "Medium Priority"
        water_depth = "25–35 mm"
    else:
        priority_tag = "Low Priority"
        water_depth = "Routine / Nil"

    ranked_priority_list.append({
        "district": d_name,
        "state": grp["state"].iloc[0],
        "crop_type": grp["crop_type"].iloc[0],
        "irrigation_priority_index": mean_ipi,
        "priority_category": priority_tag,
        "recommended_irrigation_depth": water_depth,
        "crop_water_stress_cwsi": mean_cwsi,
        "soil_moisture_level": mean_soil,
        "daily_rainfall_mm": mean_rain,
        "daily_water_deficit_mm": mean_deficit
    })

ranked_priority_list = sorted(ranked_priority_list, key=lambda x: x["irrigation_priority_index"], reverse=True)
for rank_index, item_dict in enumerate(ranked_priority_list, 1):
    item_dict["rank"] = rank_index

priority_response = {
    "title": "All-India Irrigation Priority Ranking (140+ Districts, 36 States & UTs)",
    "total_districts": len(ranked_priority_list),
    "ranked_districts": ranked_priority_list
}

@app.get("/api/irrigation/priority", summary="National Irrigation Priority Ranking")
def get_irrigation_priority():
    """Returns all districts ranked in strict descending order of irrigation urgency."""
    return priority_response

@app.get("/api/models/evaluation", summary="ML Model Evaluation Benchmarks")
def get_model_evaluation():
    """Returns classification, regression, clustering, and PCA benchmarks."""
    return evaluation_metrics

# ------------------------------------------------------------------------------
# 7. STATIC FILES MOUNT (FRONTEND WEB APP)
# ------------------------------------------------------------------------------
if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
