import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression

df_master = pd.read_csv("data/processed/krishijal_master_dataset.csv")
prefix = "models/saved_models/"

scaler = joblib.load(prefix + "feature_scaler.pkl")
model_rf = joblib.load(prefix + "crop_stress_classifier.pkl")
model_reg = joblib.load(prefix + "irrigation_priority_regressor.pkl")
model_dt = joblib.load(prefix + "crop_stress_decision_tree.pkl")
model_logreg = joblib.load(prefix + "crop_stress_logistic_regression.pkl")
model_reg_dt = joblib.load(prefix + "irrigation_decision_tree.pkl")
model_reg_lin = joblib.load(prefix + "irrigation_linear_regression.pkl")

crop_categories = sorted(df_master["crop_type"].dropna().unique().tolist())
stage_categories = sorted(df_master["growth_stage"].dropna().unique().tolist())

crop_map = {name: idx for idx, name in enumerate(crop_categories)}
stage_map = {name: idx for idx, name in enumerate(stage_categories)}

df_master["crop_code"] = df_master["crop_type"].map(crop_map).fillna(0).astype(int)
df_master["stage_code"] = df_master["growth_stage"].map(stage_map).fillna(1).astype(int)

feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

X_train = df_master[feature_cols]
X_train_scaled = pd.DataFrame(scaler.transform(X_train), columns=feature_cols)

model_knn = KNeighborsClassifier(n_neighbors=5).fit(X_train_scaled, df_master["stress_level_code"])

model_poly_priority = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(X_train_scaled, df_master["irrigation_priority_index"])

model_poly_deficit = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(X_train_scaled, df_master["water_deficit"])

stress_label_map = {0: "Low", 1: "Moderate", 2: "High", 3: "Severe"}

cluster_profiles_info = {
    0: {"name": "High-Evaporation Central & Western Zone", "description": "High temperature, moderate soil moisture."},
    1: {"name": "Humid Coastal & Floodplain Belt", "description": "High relative humidity, abundant rainfall."},
    2: {"name": "Arid & Semi-Arid Moisture-Deficit Belt", "description": "Low rainfall, sandy soils, high water stress."},
    3: {"name": "Cool Mountain & Sub-Himalayan Plateau", "description": "Lower temperature, mountain soils, stable moisture."}
}

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
    allow_headers=["*"]
)

def build_feature_row(d):
    temp = float(d.get("temperature") if d.get("temperature") is not None else (d.get("temperature_c") if d.get("temperature_c") is not None else 30.0))
    tmax = float(d.get("temp_max") if d.get("temp_max") is not None else temp + 5.5)
    tmin = float(d.get("temp_min") if d.get("temp_min") is not None else temp - 5.5)
    rain = float(d.get("rainfall") if d.get("rainfall") is not None else (d.get("rainfall_mm") if d.get("rainfall_mm") is not None else 0.0))
    hum = float(d.get("humidity") if d.get("humidity") is not None else (d.get("humidity_pct") if d.get("humidity_pct") is not None else 50.0))
    soil = float(d.get("effective_soil_wetness") if d.get("effective_soil_wetness") is not None else (d.get("soil_moisture") if d.get("soil_moisture") is not None else 0.40))
    solar = float(d.get("solar_radiation") if d.get("solar_radiation") is not None else round(0.16 * np.sqrt(max(tmax - tmin, 1.0)) * 28.0, 1))
    sph = float(d.get("soil_ph") if d.get("soil_ph") is not None else 7.4)
    soc = float(d.get("soil_organic_carbon") if d.get("soil_organic_carbon") is not None else 0.48)
    et0 = float(d.get("et0") if d.get("et0") is not None else round(0.0023 * (temp + 17.8) * np.sqrt(max(tmax - tmin, 1.0)) * 14.5, 2))
    etc = float(d.get("etc") if d.get("etc") is not None else round(et0 * 1.10, 2))
    ndvi = float(d.get("ndvi") if d.get("ndvi") is not None else round(float(np.clip(0.55 + (soil * 0.20), 0.15, 0.88)), 3))
    crop_code = int(d.get("crop_code")) if d.get("crop_code") is not None else int(crop_map.get(d.get("crop_type") or "Cotton", 0))
    stage_code = int(d.get("stage_code")) if d.get("stage_code") is not None else int(stage_map.get(d.get("growth_stage") or "Reproductive", 1))
    return pd.DataFrame([[temp, tmax, tmin, rain, hum, soil, solar, sph, soc, ndvi, et0, etc, crop_code, stage_code]], columns=feature_cols)

class PredictRequest(BaseModel):
    temperature: float = 30.0
    rainfall: float = 0.0
    humidity: float = 50.0
    effective_soil_wetness: float = 0.40
    temp_max: float = None
    temp_min: float = None
    solar_radiation: float = None
    soil_ph: float = None
    soil_organic_carbon: float = None
    ndvi: float = None
    et0: float = None
    etc: float = None
    crop_type: str = "Cotton"
    growth_stage: str = "Reproductive"
    crop_code: int = None
    stage_code: int = None
    cwsi: float = None
    water_deficit: float = None
    state: str = None
    district: str = None

class CropStressSimRequest(BaseModel):
    temperature: float = 32.5
    temperature_c: float = 32.5
    temp_max: float = 38.0
    temp_min: float = 24.0
    rainfall: float = 0.5
    rainfall_mm: float = 0.5
    humidity: float = 45.0
    humidity_pct: float = 45.0
    effective_soil_wetness: float = 0.38
    soil_moisture: float = 0.38
    solar_radiation: float = 21.0
    soil_ph: float = 7.5
    soil_organic_carbon: float = 0.45
    crop_type: str = "Cotton"
    growth_stage: str = "Reproductive"
    selected_model: str = "Random Forest"

class IrrigationPriorityRequest(BaseModel):
    temperature: float = 30.0
    rainfall: float = 0.0
    humidity: float = 50.0
    effective_soil_wetness: float = 0.40
    cwsi: float = 0.35
    water_deficit: float = 1.50
    ndvi: float = 0.60
    et0: float = 4.80
    etc: float = 5.20

root_response = {
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
    "total_records": len(df_master),
    "states_covered": int(df_master["state"].nunique()),
    "districts_covered": int(df_master["district"].nunique()),
    "web_app": "/app/"
}

@app.get("/")
def get_root():
    return root_response

health_response = {
    "status": "healthy" if (model_rf is not None and model_reg is not None and scaler is not None) else "degraded",
    "api_operational": True,
    "models_loaded": {
        "crop_stress_classifier": model_rf is not None,
        "irrigation_priority_regressor": model_reg is not None,
        "feature_scaler": scaler is not None,
        "crop_stress_decision_tree": model_dt is not None,
        "crop_stress_logistic_regression": model_logreg is not None,
        "irrigation_decision_tree": model_reg_dt is not None,
        "irrigation_linear_regression": model_reg_lin is not None
    },
    "model_errors": {},
    "model_types": {
        "classification": type(model_rf).__name__,
        "regression": type(model_reg).__name__,
        "scaler": type(scaler).__name__
    },
    "features_required": feature_cols,
    "dataset_records": len(df_master),
    "districts_covered": int(df_master["district"].nunique()),
    "states_covered": int(df_master["state"].nunique())
}

@app.get("/health")
def get_health():
    return health_response

@app.post("/predict")
def predict(item: PredictRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)
    stress_code = int(model_rf.predict(scaled_df)[0])
    raw_priority = float(model_reg.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_priority, 0.0, 100.0)), 1)
    etc_val = float(raw_df["etc"].iloc[0])
    rain_val = float(raw_df["rainfall"].iloc[0])
    soil_val = float(raw_df["effective_soil_wetness"].iloc[0])
    stress_probs = {stress_label_map.get(idx, str(idx)): round(float(p), 4) for idx, p in enumerate(model_rf.predict_proba(scaled_df)[0])} if hasattr(model_rf, "predict_proba") else {}
    condition_summary = "Severe moisture exhaustion, immediate intervention needed." if priority_index >= 60.0 else ("High stress, significant water deficit impacting crop growth." if priority_index >= 45.0 else ("Mild to moderate stress, early signs of water limitation." if priority_index >= 30.0 else "Optimal conditions, crop is healthy."))
    priority_category = "Critical Priority" if priority_index >= 60.0 else ("High Priority" if priority_index >= 45.0 else ("Medium Priority" if priority_index >= 30.0 else "Low Priority"))
    recommended_depth = "45–55 mm" if priority_index >= 60.0 else ("35–45 mm" if priority_index >= 45.0 else ("20–30 mm" if priority_index >= 30.0 else "Routine / Nil"))
    advisory = "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required." if priority_index >= 60.0 else ("HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours." if priority_index >= 45.0 else ("MODERATE: Soil moisture depleting. Plan irrigation cycle within 3–4 days." if priority_index >= 30.0 else "ADEQUATE: Moisture levels optimal. Continue standard crop monitoring."))
    daily_deficit = max(0.0, round(etc_val - (rain_val + soil_val * etc_val), 2))
    return {
        "status": "success",
        "location": {"state": item.state, "district": item.district},
        "input_features": {col: float(raw_df[col].iloc[0]) for col in feature_cols},
        "crop_stress_prediction": {
            "stress_level_code": stress_code,
            "stress_level": stress_label_map.get(stress_code, "Moderate"),
            "stress_probabilities": stress_probs,
            "condition_summary": condition_summary
        },
        "irrigation_priority_prediction": {
            "irrigation_priority_index": priority_index,
            "priority_category": priority_category,
            "recommended_irrigation_depth": recommended_depth,
            "actionable_farmer_advisory": advisory
        },
        "calculated_agronomic_indicators": {
            "daily_water_deficit_mm": daily_deficit,
            "reference_et0_mm": float(raw_df["et0"].iloc[0]),
            "crop_etc_mm": float(raw_df["etc"].iloc[0]),
            "vegetation_ndvi": float(raw_df["ndvi"].iloc[0])
        },
        "models_used": {
            "classifier": "Tuned RandomForestClassifier (.pkl)",
            "regressor": "Tuned RandomForestRegressor (.pkl)"
        }
    }

@app.post("/api/predict/crop-stress")
def predict_crop_stress(item: CropStressSimRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)
    chosen_clf = model_dt if "Tree" in (item.selected_model or "") else (model_logreg if "Logistic" in (item.selected_model or "") else (model_knn if "KNN" in (item.selected_model or "") else model_rf))
    model_tag = "Decision Tree Classifier" if "Tree" in (item.selected_model or "") else ("Logistic Regression" if "Logistic" in (item.selected_model or "") else ("K-Nearest Neighbors" if "KNN" in (item.selected_model or "") else "Tuned Random Forest Classifier (.pkl)"))
    stress_code = int(chosen_clf.predict(scaled_df)[0])
    raw_priority = float(model_reg.predict(scaled_df)[0])
    raw_deficit = float(model_poly_deficit.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_priority, 0.0, 100.0)), 1)
    deficit_val = round(float(np.clip(raw_deficit, 0.0, 15.0)), 2)
    urgency_color = "#d62728" if priority_index >= 50.0 else ("#ff7f0e" if priority_index >= 35.0 else "#2ca02c")
    recommendation = "Severe water stress detected. Apply 35-45 mm irrigation immediately." if priority_index >= 50.0 else ("Soil moisture is declining. Prepare irrigation within 48-72 hours." if priority_index >= 35.0 else "Moisture is adequate. Continue regular monitoring.")
    return {
        "crop_stress_level": stress_label_map.get(stress_code, "Low"),
        "crop_stress_code": stress_code,
        "model_used": model_tag,
        "predicted_water_deficit_mm_per_day": deficit_val,
        "irrigation_priority_index": priority_index,
        "irrigation_priority_level": "High Priority" if priority_index >= 50.0 else ("Medium Priority" if priority_index >= 35.0 else "Low Priority"),
        "urgency_color": urgency_color,
        "recommendation": recommendation,
        "calculated_agronomic_indicators": {
            "reference_et0_mm": float(raw_df["et0"].iloc[0]),
            "crop_etc_mm": float(raw_df["etc"].iloc[0]),
            "estimated_ndvi": float(raw_df["ndvi"].iloc[0])
        }
    }

@app.post("/api/predict/irrigation-priority")
def predict_irrigation_priority(item: IrrigationPriorityRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)
    raw_val = float(model_reg.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_val, 0.0, 100.0)), 1)
    priority_tag = "Critical Priority" if priority_index >= 60.0 else ("High Priority" if priority_index >= 45.0 else ("Medium Priority" if priority_index >= 30.0 else "Low Priority"))
    depth = "45–55 mm" if priority_index >= 60.0 else ("35–45 mm" if priority_index >= 45.0 else ("20–30 mm" if priority_index >= 30.0 else "Routine / Nil"))
    advisory = "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required." if priority_index >= 60.0 else ("HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours." if priority_index >= 45.0 else ("MODERATE: Soil wetness is depleting. Schedule irrigation in 48-72 hours." if priority_index >= 30.0 else "ADEQUATE: Moisture levels optimal. Continue standard monitoring."))
    return {
        "irrigation_priority_index": priority_index,
        "priority_category": priority_tag,
        "recommended_irrigation_depth": depth,
        "actionable_farmer_advisory": advisory,
        "model_used": "Tuned Random Forest Regressor (.pkl)"
    }

dataset_payload = {
    "total_records": len(df_master),
    "total_districts": int(df_master["district"].nunique()),
    "total_states": int(df_master["state"].nunique()),
    "states_list": sorted(df_master["state"].unique().tolist()),
    "districts_list": sorted(df_master["district"].unique().tolist()),
    "crops_covered": sorted(df_master["crop_type"].unique().tolist()),
    "national_averages": {
        "mean_temperature_c": round(float(df_master["temperature"].mean()), 2),
        "mean_rainfall_mm": round(float(df_master["rainfall"].mean()), 2),
        "mean_humidity_pct": round(float(df_master["humidity"].mean()), 2),
        "mean_soil_moisture": round(float(df_master["effective_soil_wetness"].mean()), 3),
        "mean_crop_etc_mm": round(float(df_master["etc"].mean()), 2),
        "mean_irrigation_priority_index": round(float(df_master["irrigation_priority_index"].mean()), 1)
    },
    "stress_level_distribution": df_master["stress_level"].value_counts().to_dict(),
    "irrigation_priority_distribution": df_master["irrigation_priority"].value_counts().to_dict()
}

@app.get("/api/dataset/info")
def get_dataset_info():
    return dataset_payload

districts_summary = []
for d_name, grp in df_master.groupby("district"):
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

@app.get("/api/districts")
def get_districts():
    return {"total_districts": len(districts_summary), "districts": districts_summary}

cluster_list = []
for d_name, grp in df_master.groupby("district"):
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

@app.get("/api/clusters/regions")
def get_clusters_regions():
    return clusters_response

ranked_priority_list = []
for d_name, grp in df_master.groupby("district"):
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

@app.get("/api/irrigation/priority")
def get_irrigation_priority():
    return priority_response

evaluation_metrics = {
    "dataset_source": "data/processed/krishijal_master_dataset.csv",
    "total_records": 6654,
    "train_records": 5323,
    "test_records": 1331,
    "feature_names": feature_cols,
    "n_features": 14,
    "classification": {
        "Random Forest (Tuned)": {
            "accuracy": 0.9962,
            "precision": 0.9963,
            "recall": 0.9962,
            "f1_score": 0.9963,
            "confusion_matrix": [[994, 3, 0, 0], [0, 180, 2, 0], [0, 0, 113, 0], [0, 0, 0, 39]]
        },
        "Decision Tree": {
            "accuracy": 0.9880,
            "precision": 0.9883,
            "recall": 0.9880,
            "f1_score": 0.9881,
            "confusion_matrix": [[988, 9, 0, 0], [2, 179, 1, 0], [0, 2, 110, 1], [0, 0, 1, 38]]
        },
        "Logistic Regression": {
            "accuracy": 0.9594,
            "precision": 0.9640,
            "recall": 0.9594,
            "f1_score": 0.9607,
            "confusion_matrix": [[961, 36, 0, 0], [1, 172, 9, 0], [0, 4, 105, 4], [0, 0, 0, 39]]
        },
        "KNN (k=5)": {
            "accuracy": 0.9279,
            "precision": 0.9362,
            "recall": 0.9279,
            "f1_score": 0.9307,
            "confusion_matrix": [[944, 53, 0, 0], [9, 157, 16, 0], [1, 10, 97, 5], [0, 0, 2, 37]]
        },
        "Gaussian Naive Bayes": {
            "accuracy": 0.8114,
            "precision": 0.8526,
            "recall": 0.8114,
            "f1_score": 0.8267,
            "confusion_matrix": [[868, 119, 10, 0], [13, 121, 48, 0], [7, 22, 63, 21], [0, 0, 11, 28]]
        }
    },
    "regression": {
        "Random Forest Regressor (Tuned)": {
            "mae": 0.4293,
            "mse": 0.8831,
            "rmse": 0.9398,
            "r2_score": 0.9954
        },
        "Decision Tree Regressor": {
            "mae": 0.8521,
            "mse": 2.1450,
            "rmse": 1.4646,
            "r2_score": 0.9888
        },
        "Polynomial Regression (Deg 2)": {
            "mae": 2.5952,
            "mse": 11.5902,
            "rmse": 3.4044,
            "r2_score": 0.9394
        },
        "Linear Regression": {
            "mae": 4.8669,
            "mse": 37.1909,
            "rmse": 6.0984,
            "r2_score": 0.8055
        }
    },
    "clustering": {
        "K-Means (k=4)": {
            "silhouette_score": 0.2174,
            "davies_bouldin_score": 1.5201,
            "inertia": 37403.38
        },
        "PCA (2D Projection)": {
            "total_explained_variance": 0.5698,
            "pc1_explained_variance_ratio": 0.3919,
            "pc2_explained_variance_ratio": 0.1779
        }
    }
}

@app.get("/api/models/evaluation")
def get_models_evaluation():
    return evaluation_metrics

app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")
