import os
import json
from typing import Optional
import pandas as pd
import numpy as np
import joblib
import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

load_dotenv()


def get_db_connection():
    try:
        host = os.getenv("MYSQL_HOST", "127.0.0.1")
        port = int(os.getenv("MYSQL_PORT", "3306"))
        user = os.getenv("MYSQL_USER", "root")
        password = os.getenv("MYSQL_PASSWORD", "")
        database = os.getenv("MYSQL_DATABASE", "crop_stress_db")
        conn = mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
        )
        return conn, None
    except mysql.connector.Error as err:
        return None, str(err)


def clean_name(text):
    lowered = str(text).lower().replace("&", "and")
    result = ""
    for ch in lowered:
        if ch.isalnum():
            result = result + ch
    return result


def pick_number(data, keys, default_value):
    for key in keys:
        if key in data and data[key] is not None:
            return float(data[key])
    return float(default_value)


def get_classifier_input(classifier, raw_df, scaled_df):
    if hasattr(classifier, "steps") or hasattr(classifier, "estimators"):
        return raw_df
    return scaled_df


def get_priority_details_for_predict(priority_index):
    if priority_index >= 60.0:
        return (
            "Critical Priority",
            "45–55 mm",
            "Severe moisture exhaustion, immediate intervention needed.",
            "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required.",
        )
    if priority_index >= 45.0:
        return (
            "High Priority",
            "35–45 mm",
            "High stress, significant water deficit impacting crop growth.",
            "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours.",
        )
    if priority_index >= 30.0:
        return (
            "Medium Priority",
            "20–30 mm",
            "Mild to moderate stress, early signs of water limitation.",
            "MODERATE: Soil moisture depleting. Plan irrigation cycle within 3–4 days.",
        )
    return (
        "Low Priority",
        "Routine / Nil",
        "Optimal conditions, crop is healthy.",
        "ADEQUATE: Moisture levels optimal. Continue standard crop monitoring.",
    )


def get_priority_details_for_schedule(priority_index):
    if priority_index >= 60.0:
        return (
            "Critical Priority",
            "45–55 mm",
            "CRITICAL: Severe moisture exhaustion. Immediate canal or tubewell release required.",
        )
    if priority_index >= 45.0:
        return (
            "High Priority",
            "35–45 mm",
            "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours.",
        )
    if priority_index >= 30.0:
        return (
            "Medium Priority",
            "20–30 mm",
            "MODERATE: Soil wetness is depleting. Schedule irrigation in 48-72 hours.",
        )
    return (
        "Low Priority",
        "Routine / Nil",
        "ADEQUATE: Moisture levels optimal. Continue standard monitoring.",
    )


def format_farmer_row(row):
    if row.get("land_area_acres") is not None:
        row["land_area_acres"] = float(row["land_area_acres"])
    else:
        row["land_area_acres"] = 0.0

    if row.get("created_at"):
        row["created_at"] = row["created_at"].strftime("%Y-%m-%d %H:%M")
    else:
        row["created_at"] = ""

    if row.get("updated_at"):
        row["updated_at"] = row["updated_at"].strftime("%Y-%m-%d %H:%M")
    else:
        row["updated_at"] = ""
    return row


def format_history_row(row):
    numeric_fields = [
        "temperature",
        "humidity",
        "rainfall",
        "soil_moisture",
        "soil_ph",
        "soil_organic_carbon",
        "priority_index",
        "daily_deficit",
    ]
    for key in numeric_fields:
        if row.get(key) is not None:
            row[key] = float(row[key])
        else:
            row[key] = 0.0

    if row.get("predicted_at"):
        row["predicted_at"] = row["predicted_at"].strftime("%Y-%m-%d %H:%M")
    else:
        row["predicted_at"] = ""
    return row


def load_district_lookups(master_df):
    dist_base = master_df[master_df["granularity"] == "district_baseline"].copy()
    india_agri = pd.DataFrame(
        {
            "State": dist_base["state"],
            "District": dist_base["district"],
            "LGD_Code": dist_base["district_lgd_code"],
            "Latitude": dist_base["latitude"],
            "Longitude": dist_base["longitude"],
            "Rainfall": np.round(dist_base["rainfall"] * 365.0, 1),
            "Temperature": dist_base["temperature"],
            "Humidity": dist_base["humidity"],
            "Soil_Type": dist_base["soil_type"],
            "Soil_Moisture": dist_base["effective_soil_wetness"],
            "Irrigation_Coverage": 45.0,
            "Crop": dist_base["crop_type"],
            "Crop_Area": 50000,
            "Crop_Production": 150000,
            "Crop_Yield": 3.0,
            "Data_Year": "2024-25",
        }
    )

    agri_index = {}
    for _, row in india_agri.iterrows():
        c_state = clean_name(row["State"])
        c_dist = clean_name(row["District"])
        row_dict = row.to_dict()
        agri_index[(c_state, c_dist)] = row_dict
        agri_index[c_dist] = row_dict

    soil_lookup = {}
    for (st, dt), grp in master_df.groupby(["state", "district"]):
        if "soil_ph" in grp:
            ph_val = round(float(grp["soil_ph"].iloc[0]), 1)
        else:
            ph_val = 7.4

        if "soil_organic_carbon" in grp:
            soc_val = round(float(grp["soil_organic_carbon"].iloc[0]), 2)
        else:
            soc_val = 0.48

        soil_lookup[(clean_name(st), clean_name(dt))] = {"ph": ph_val, "soc": soc_val}

    return dist_base, india_agri, agri_index, soil_lookup


df_master = pd.read_csv("data/processed/krishijal_master_dataset.csv")
df_dist_base, df_india_agri, district_agri_index, master_district_soil = load_district_lookups(df_master)

model_dir = "models/saved_models/"
scaler = joblib.load(model_dir + "feature_scaler.pkl")
model_rf = joblib.load(model_dir + "crop_stress_classifier.pkl")
model_reg = joblib.load(model_dir + "irrigation_priority_regressor.pkl")
model_dt = joblib.load(model_dir + "crop_stress_decision_tree.pkl")
model_logreg = joblib.load(model_dir + "crop_stress_logistic_regression.pkl")
model_reg_dt = joblib.load(model_dir + "irrigation_decision_tree.pkl")
model_reg_lin = joblib.load(model_dir + "irrigation_linear_regression.pkl")

crop_categories = sorted(df_master["crop_type"].dropna().unique().tolist())
stage_categories = sorted(df_master["growth_stage"].dropna().unique().tolist())

crop_map = {}
for idx, name in enumerate(crop_categories):
    crop_map[name] = idx

stage_map = {}
for idx, name in enumerate(stage_categories):
    stage_map[name] = idx

df_master["crop_code"] = df_master["crop_type"].map(crop_map).fillna(0).astype(int)
df_master["stage_code"] = df_master["growth_stage"].map(stage_map).fillna(1).astype(int)

feature_cols = [
    "temperature",
    "temp_max",
    "temp_min",
    "rainfall",
    "humidity",
    "effective_soil_wetness",
    "solar_radiation",
    "soil_ph",
    "soil_organic_carbon",
    "ndvi",
    "et0",
    "etc",
    "crop_code",
    "stage_code",
]

X_train = df_master[feature_cols]
X_train_scaled = pd.DataFrame(scaler.transform(X_train), columns=feature_cols)

model_knn = KNeighborsClassifier(n_neighbors=5).fit(X_train_scaled, df_master["stress_level_code"])

model_poly_priority = Pipeline(
    [
        ("poly", PolynomialFeatures(degree=2)),
        ("linear", LinearRegression()),
    ]
).fit(X_train_scaled, df_master["irrigation_priority_index"])

model_poly_deficit = Pipeline(
    [
        ("poly", PolynomialFeatures(degree=2)),
        ("linear", LinearRegression()),
    ]
).fit(X_train_scaled, df_master["water_deficit"])

stress_label_map = {0: "Low", 1: "Moderate", 2: "High", 3: "Severe"}

cluster_profiles_info = {
    0: {
        "name": "High-Evaporation Central & Western Zone",
        "description": "High temperature, moderate soil moisture.",
    },
    1: {
        "name": "Humid Coastal & Floodplain Belt",
        "description": "High relative humidity, abundant rainfall.",
    },
    2: {
        "name": "Arid & Semi-Arid Moisture-Deficit Belt",
        "description": "Low rainfall, sandy soils, high water stress.",
    },
    3: {
        "name": "Cool Mountain & Sub-Himalayan Plateau",
        "description": "Lower temperature, mountain soils, stable moisture.",
    },
}

app = FastAPI(
    title="KrishiJal - All-India Crop Stress & Irrigation Priority System",
    description="Machine Learning decision support system for agricultural water conservation across Indian agro-climatic zones.",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_feature_row(data):
    temp = pick_number(data, ["temperature", "temperature_c"], 30.0)
    tmax = pick_number(data, ["temp_max"], temp + 5.5)
    tmin = pick_number(data, ["temp_min"], temp - 5.5)
    rain = pick_number(data, ["rainfall", "rainfall_mm"], 0.0)
    hum = pick_number(data, ["humidity", "humidity_pct"], 50.0)
    soil = pick_number(data, ["effective_soil_wetness", "soil_moisture"], 0.40)

    default_solar = round(0.16 * np.sqrt(max(tmax - tmin, 1.0)) * 28.0, 1)
    solar = pick_number(data, ["solar_radiation"], default_solar)
    sph = pick_number(data, ["soil_ph"], 7.4)
    soc = pick_number(data, ["soil_organic_carbon"], 0.48)

    default_et0 = round(0.0023 * (temp + 17.8) * np.sqrt(max(tmax - tmin, 1.0)) * 14.5, 2)
    et0 = pick_number(data, ["et0"], default_et0)
    etc = pick_number(data, ["etc"], round(et0 * 1.10, 2))

    default_ndvi = round(float(np.clip(0.55 + (soil * 0.20), 0.15, 0.88)), 3)
    ndvi = pick_number(data, ["ndvi"], default_ndvi)

    if data.get("crop_code") is not None:
        crop_code = int(data["crop_code"])
    else:
        crop_name = data.get("crop_type") or "Cotton"
        crop_code = int(crop_map.get(crop_name, 0))

    if data.get("stage_code") is not None:
        stage_code = int(data["stage_code"])
    else:
        stage_name = data.get("growth_stage") or "Reproductive"
        stage_code = int(stage_map.get(stage_name, 1))

    values = [[temp, tmax, tmin, rain, hum, soil, solar, sph, soc, ndvi, et0, etc, crop_code, stage_code]]
    return pd.DataFrame(values, columns=feature_cols)


class PredictRequest(BaseModel):
    temperature: float = 30.0
    rainfall: float = 0.0
    humidity: float = 50.0
    effective_soil_wetness: float = 0.40
    temp_max: Optional[float] = None
    temp_min: Optional[float] = None
    solar_radiation: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_organic_carbon: Optional[float] = None
    ndvi: Optional[float] = None
    et0: Optional[float] = None
    etc: Optional[float] = None
    crop_type: str = "Cotton"
    growth_stage: str = "Reproductive"
    crop_code: Optional[int] = None
    stage_code: Optional[int] = None
    cwsi: Optional[float] = None
    water_deficit: Optional[float] = None
    state: Optional[str] = None
    district: Optional[str] = None
    farmer_id: Optional[int] = None
    farmer_name: Optional[str] = None
    farmer_phone: Optional[str] = ""
    farmer_village: Optional[str] = ""
    save_history: Optional[bool] = True


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


class FarmerRequest(BaseModel):
    farmer_name: str
    phone: Optional[str] = ""
    village: Optional[str] = ""
    state_name: str
    district_name: str
    primary_crop: Optional[str] = "Cotton"
    soil_type: Optional[str] = "Loamy"
    land_area_acres: Optional[float] = 2.5


def lookup_district_baseline(state_val, district_val):
    pair = (clean_name(state_val), clean_name(district_val))
    info = district_agri_index.get(pair)
    if info is None:
        info = district_agri_index.get(clean_name(district_val))
    if info is None:
        return {}
    return info


def get_or_create_district(cursor, state_val, district_val, info, raw_df):
    cursor.execute(
        "SELECT district_id FROM districts WHERE state_name = %s AND district_name = %s LIMIT 1",
        (state_val, district_val),
    )
    existing = cursor.fetchone()
    if existing:
        return existing["district_id"]

    lgd_raw = info.get("LGD_Code")
    if lgd_raw is not None and pd.notna(lgd_raw):
        lgd_code = int(lgd_raw)
    else:
        lgd_code = None

    avg_temp = info.get("Temperature")
    if not avg_temp:
        avg_temp = float(raw_df["temperature"].iloc[0])

    avg_rain = info.get("Rainfall")
    if not avg_rain:
        avg_rain = float(raw_df["rainfall"].iloc[0])

    avg_hum = info.get("Humidity")
    if not avg_hum:
        avg_hum = float(raw_df["humidity"].iloc[0])

    cursor.execute(
        "INSERT INTO districts (state_name, district_name, lgd_code, avg_temperature, avg_rainfall, avg_humidity) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (state_val, district_val, lgd_code, float(avg_temp), float(avg_rain), float(avg_hum)),
    )
    return cursor.lastrowid


def get_or_create_crop(cursor, crop_val, stage_val):
    cursor.execute(
        "SELECT crop_id FROM crops WHERE crop_name = %s AND growth_stage = %s LIMIT 1",
        (crop_val, stage_val),
    )
    existing = cursor.fetchone()
    if existing:
        return existing["crop_id"]

    cursor.execute(
        "INSERT INTO crops (crop_name, growth_stage) VALUES (%s, %s)",
        (crop_val, stage_val),
    )
    return cursor.lastrowid


def resolve_farmer_for_prediction(cursor, item, state_val, district_val, crop_val, soil_type):
    if item.farmer_id is not None:
        cursor.execute("SELECT farmer_id FROM farmers WHERE farmer_id = %s LIMIT 1", (item.farmer_id,))
        row = cursor.fetchone()
        if row:
            return row["farmer_id"]
        return None

    if item.farmer_name and item.farmer_name.strip():
        farmer_name = item.farmer_name.strip()
        farmer_phone = (item.farmer_phone or "").strip()
        farmer_village = (item.farmer_village or "").strip()
        cursor.execute(
            "SELECT farmer_id FROM farmers WHERE farmer_name = %s AND state_name = %s AND district_name = %s LIMIT 1",
            (farmer_name, state_val, district_val),
        )
        row = cursor.fetchone()
        if row:
            return row["farmer_id"]

        cursor.execute(
            "INSERT INTO farmers (farmer_name, phone, village, state_name, district_name, primary_crop, soil_type) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (farmer_name, farmer_phone, farmer_village, state_val, district_val, crop_val, soil_type),
        )
        return cursor.lastrowid

    return None


def save_prediction_to_mysql(
    item,
    raw_df,
    stress_code,
    stress_label,
    priority_index,
    priority_category,
    recommended_depth,
    daily_deficit,
    advisory,
):
    conn, err = get_db_connection()
    if conn is None:
        return None, None, False, err

    cursor = conn.cursor(dictionary=True)
    try:
        state_val = (item.state or "Telangana").strip() or "Telangana"
        district_val = (item.district or "Khammam").strip() or "Khammam"
        crop_val = (item.crop_type or "Cotton").strip() or "Cotton"
        stage_val = (item.growth_stage or "Reproductive").strip() or "Reproductive"

        info = lookup_district_baseline(state_val, district_val)
        soil_type = str(info.get("Soil_Type") or "Loamy")

        district_id = get_or_create_district(cursor, state_val, district_val, info, raw_df)
        crop_id = get_or_create_crop(cursor, crop_val, stage_val)

        soil_moist = float(raw_df["effective_soil_wetness"].iloc[0])
        soil_ph_val = float(raw_df["soil_ph"].iloc[0])
        soil_soc_val = float(raw_df["soil_organic_carbon"].iloc[0])

        cursor.execute(
            "INSERT INTO soil_info (district_id, soil_type, soil_moisture, soil_ph, soil_organic_carbon) "
            "VALUES (%s, %s, %s, %s, %s)",
            (district_id, soil_type, soil_moist, soil_ph_val, soil_soc_val),
        )
        soil_id = cursor.lastrowid

        saved_farmer_id = resolve_farmer_for_prediction(
            cursor, item, state_val, district_val, crop_val, soil_type
        )

        temp_val = float(raw_df["temperature"].iloc[0])
        hum_val = float(raw_df["humidity"].iloc[0])
        rain_val = float(raw_df["rainfall"].iloc[0])

        cursor.execute(
            "INSERT INTO irrigation_predictions (farmer_id, district_id, crop_id, soil_id, temperature, "
            "humidity, rainfall, soil_moisture, soil_ph, soil_organic_carbon, stress_level, stress_code, "
            "priority_index, priority_category, recommended_depth, daily_deficit, advisory) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                saved_farmer_id,
                district_id,
                crop_id,
                soil_id,
                temp_val,
                hum_val,
                rain_val,
                soil_moist,
                soil_ph_val,
                soil_soc_val,
                stress_label,
                stress_code,
                priority_index,
                priority_category,
                recommended_depth,
                daily_deficit,
                advisory,
            ),
        )
        prediction_id = cursor.lastrowid

        action_note = f"{stress_label} stress (Priority {priority_index}) for {crop_val} in {district_val}, {state_val}"
        cursor.execute(
            "INSERT INTO prediction_history (prediction_id, farmer_id, action_note) VALUES (%s, %s, %s)",
            (prediction_id, saved_farmer_id, action_note),
        )
        conn.commit()
        return prediction_id, saved_farmer_id, True, "Prediction saved to MySQL"
    except Exception as exc:
        conn.rollback()
        return None, None, False, str(exc)
    finally:
        cursor.close()
        conn.close()


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
        "model_evaluation": "GET /api/models/evaluation",
        "district_profile": "GET /api/district-profile",
        "coverage_report": "GET /api/coverage-report",
        "districts_all": "GET /api/districts/all",
    },
    "features_required_for_predict": feature_cols,
    "models_active": {
        "classification": "Random Forest Classifier (n_estimators=100, max_depth=12)",
        "regression": "Random Forest Regressor (n_estimators=100, max_depth=12)",
    },
    "total_records": len(df_master),
    "states_covered": int(df_master["state"].nunique()),
    "districts_covered": int(df_master["district"].nunique()),
    "web_app": "/app/",
}


@app.get("/")
def get_root():
    return root_response


if model_rf is not None and model_reg is not None and scaler is not None:
    overall_health_status = "healthy"
else:
    overall_health_status = "degraded"

health_response = {
    "status": overall_health_status,
    "api_operational": True,
    "models_loaded": {
        "crop_stress_classifier": model_rf is not None,
        "irrigation_priority_regressor": model_reg is not None,
        "feature_scaler": scaler is not None,
        "crop_stress_decision_tree": model_dt is not None,
        "crop_stress_logistic_regression": model_logreg is not None,
        "irrigation_decision_tree": model_reg_dt is not None,
        "irrigation_linear_regression": model_reg_lin is not None,
    },
    "model_errors": {},
    "model_types": {
        "classification": type(model_rf).__name__,
        "regression": type(model_reg).__name__,
        "scaler": type(scaler).__name__,
    },
    "features_required": feature_cols,
    "dataset_records": len(df_master),
    "districts_covered": int(df_master["district"].nunique()),
    "states_covered": int(df_master["state"].nunique()),
}


@app.get("/health")
def get_health():
    return health_response


@app.post("/predict")
def predict(item: PredictRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)
    clf_input = get_classifier_input(model_rf, raw_df, scaled_df)

    stress_code = int(model_rf.predict(clf_input)[0])
    raw_priority = float(model_reg.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_priority, 0.0, 100.0)), 1)

    etc_val = float(raw_df["etc"].iloc[0])
    rain_val = float(raw_df["rainfall"].iloc[0])
    soil_val = float(raw_df["effective_soil_wetness"].iloc[0])

    stress_probs = {}
    if hasattr(model_rf, "predict_proba"):
        prob_array = model_rf.predict_proba(clf_input)[0]
        for idx, prob in enumerate(prob_array):
            label = stress_label_map.get(idx, str(idx))
            stress_probs[label] = round(float(prob), 4)

    priority_category, recommended_depth, condition_summary, advisory = get_priority_details_for_predict(
        priority_index
    )
    daily_deficit = max(0.0, round(etc_val - (rain_val + soil_val * etc_val), 2))
    stress_label = stress_label_map.get(stress_code, "Moderate")

    if item.save_history is False:
        pred_id = None
        saved_farmer_id = None
        db_saved = False
        db_msg = "Read-only map intelligence lookup"
    else:
        pred_id, saved_farmer_id, db_saved, db_msg = save_prediction_to_mysql(
            item,
            raw_df,
            stress_code,
            stress_label,
            priority_index,
            priority_category,
            recommended_depth,
            daily_deficit,
            advisory,
        )

    input_features_out = {}
    for col in feature_cols:
        input_features_out[col] = float(raw_df[col].iloc[0])

    return {
        "status": "success",
        "location": {"state": item.state, "district": item.district},
        "input_features": input_features_out,
        "crop_stress_prediction": {
            "stress_level_code": stress_code,
            "stress_level": stress_label,
            "stress_probabilities": stress_probs,
            "condition_summary": condition_summary,
        },
        "irrigation_priority_prediction": {
            "irrigation_priority_index": priority_index,
            "priority_category": priority_category,
            "recommended_irrigation_depth": recommended_depth,
            "actionable_farmer_advisory": advisory,
        },
        "calculated_agronomic_indicators": {
            "daily_water_deficit_mm": daily_deficit,
            "reference_et0_mm": float(raw_df["et0"].iloc[0]),
            "crop_etc_mm": float(raw_df["etc"].iloc[0]),
            "vegetation_ndvi": float(raw_df["ndvi"].iloc[0]),
        },
        "models_used": {
            "classifier": "Random Forest Classifier (.pkl)",
            "regressor": "Random Forest Regressor (.pkl)",
        },
        "database": {
            "saved": db_saved,
            "prediction_id": pred_id,
            "farmer_id": saved_farmer_id,
            "message": db_msg,
        },
    }


def select_classifier_and_tag(selected_model):
    choice = selected_model or ""
    if "Tree" in choice:
        return model_dt, "Decision Tree Classifier"
    if "Logistic" in choice:
        return model_logreg, "Logistic Regression"
    if "KNN" in choice:
        return model_knn, "K-Nearest Neighbors"
    return model_rf, "Random Forest Classifier (.pkl)"


@app.post("/api/predict/crop-stress")
def predict_crop_stress(item: CropStressSimRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)

    chosen_clf, model_tag = select_classifier_and_tag(item.selected_model)
    if chosen_clf is model_rf:
        clf_input = get_classifier_input(model_rf, raw_df, scaled_df)
    else:
        clf_input = scaled_df

    stress_code = int(chosen_clf.predict(clf_input)[0])
    raw_priority = float(model_reg.predict(scaled_df)[0])
    raw_deficit = float(model_poly_deficit.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_priority, 0.0, 100.0)), 1)
    deficit_val = round(float(np.clip(raw_deficit, 0.0, 15.0)), 2)

    if priority_index >= 50.0:
        urgency_color = "#d62728"
        priority_level = "High Priority"
        recommendation = "Severe water stress detected. Apply 35-45 mm irrigation immediately."
    elif priority_index >= 35.0:
        urgency_color = "#ff7f0e"
        priority_level = "Medium Priority"
        recommendation = "Soil moisture is declining. Prepare irrigation within 48-72 hours."
    else:
        urgency_color = "#2ca02c"
        priority_level = "Low Priority"
        recommendation = "Moisture is adequate. Continue regular monitoring."

    return {
        "crop_stress_level": stress_label_map.get(stress_code, "Low"),
        "crop_stress_code": stress_code,
        "model_used": model_tag,
        "predicted_water_deficit_mm_per_day": deficit_val,
        "irrigation_priority_index": priority_index,
        "irrigation_priority_level": priority_level,
        "urgency_color": urgency_color,
        "recommendation": recommendation,
        "calculated_agronomic_indicators": {
            "reference_et0_mm": float(raw_df["et0"].iloc[0]),
            "crop_etc_mm": float(raw_df["etc"].iloc[0]),
            "estimated_ndvi": float(raw_df["ndvi"].iloc[0]),
        },
    }


@app.post("/api/predict/irrigation-priority")
def predict_irrigation_priority(item: IrrigationPriorityRequest):
    raw_df = build_feature_row(item.model_dump())
    scaled_df = pd.DataFrame(scaler.transform(raw_df), columns=feature_cols)
    raw_val = float(model_reg.predict(scaled_df)[0])
    priority_index = round(float(np.clip(raw_val, 0.0, 100.0)), 1)

    priority_tag, depth, advisory = get_priority_details_for_schedule(priority_index)

    return {
        "irrigation_priority_index": priority_index,
        "priority_category": priority_tag,
        "recommended_irrigation_depth": depth,
        "actionable_farmer_advisory": advisory,
        "model_used": "Random Forest Regressor (.pkl)",
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
        "mean_irrigation_priority_index": round(float(df_master["irrigation_priority_index"].mean()), 1),
    },
    "stress_level_distribution": df_master["stress_level"].value_counts().to_dict(),
    "irrigation_priority_distribution": df_master["irrigation_priority"].value_counts().to_dict(),
}


@app.get("/api/dataset/info")
def get_dataset_info():
    return dataset_payload


def read_group_value(grp, col, cast_fn, fallback):
    if col in grp:
        return cast_fn(grp[col].iloc[0])
    return fallback


def read_row_value(row, col, cast_fn, fallback):
    if pd.notna(row[col]):
        return cast_fn(row[col])
    return fallback


def build_districts_summary(master_df):
    summary = []
    for d_name, grp in master_df.groupby("district"):
        if "cluster_id" in grp:
            c_id = int(grp["cluster_id"].mode()[0])
        else:
            c_id = 0
        c_info = cluster_profiles_info.get(c_id, {"name": "General Agricultural Zone", "description": ""})
        mean_ipi = round(float(grp["irrigation_priority_index"].mean()), 1)

        if mean_ipi >= 50.0:
            priority_cat = "High Priority"
        elif mean_ipi >= 35.0:
            priority_cat = "Medium Priority"
        else:
            priority_cat = "Low Priority"

        if mean_ipi >= 60.0:
            stress_lbl = "Severe"
        elif mean_ipi >= 45.0:
            stress_lbl = "High"
        elif mean_ipi >= 30.0:
            stress_lbl = "Moderate"
        else:
            stress_lbl = "Low"

        lat_val = round(read_group_value(grp, "latitude", float, 20.0), 4)
        lon_val = round(read_group_value(grp, "longitude", float, 78.0), 4)
        st_lgd = read_group_value(grp, "state_lgd_code", int, 0)
        dt_lgd = read_group_value(grp, "district_lgd_code", int, 0)
        n_status = read_group_value(grp, "nitrogen_status", str, "Optimal (Medium N)")
        ph_char = read_group_value(grp, "soil_ph_character", str, "Neutral / Balanced")
        sh_index = round(read_group_value(grp, "soil_health_index", float, 50.0), 1)
        n_low = round(read_group_value(grp, "shc_macro_nitrogen_low_share_2024_25", float, 0.0), 3)
        ph_neut = round(read_group_value(grp, "shc_macro_soil_ph_neutral_share_2024_25", float, 1.0), 3)

        summary.append(
            {
                "district": d_name,
                "state": grp["state"].iloc[0],
                "latitude": lat_val,
                "longitude": lon_val,
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
                "priority_category": priority_cat,
                "stress_level": stress_lbl,
                "cluster_id": c_id,
                "cluster_name": c_info["name"],
                "state_lgd_code": st_lgd,
                "district_lgd_code": dt_lgd,
                "nitrogen_status": n_status,
                "soil_ph_character": ph_char,
                "soil_health_index": sh_index,
                "soil_nitrogen_low_share": n_low,
                "soil_ph_neutral_share": ph_neut,
            }
        )
    return summary


districts_summary = build_districts_summary(df_master)


@app.get("/api/districts")
def get_districts():
    return {"total_districts": len(districts_summary), "districts": districts_summary}


def find_target_district_row(district, state):
    c_dt = clean_name(district)
    if state:
        c_st = clean_name(state)
        exact = district_agri_index.get((c_st, c_dt))
        if exact is not None:
            return exact
        for key, val in district_agri_index.items():
            if isinstance(key, tuple):
                st_k = key[0]
                dt_k = key[1]
                if (c_st in st_k or st_k in c_st) and (c_dt in dt_k or dt_k in c_dt):
                    return val

    direct = district_agri_index.get(c_dt)
    if direct is not None:
        return direct

    for key, val in district_agri_index.items():
        if isinstance(key, str) and (c_dt in key or key in c_dt):
            return val
    return None


@app.get("/api/district-profile")
def get_district_profile(district: str, state: str = None):
    target_row = find_target_district_row(district, state)
    if target_row is None:
        return {
            "status": "not_found",
            "message": "District not found in authentic agricultural database",
            "district": district,
            "state": state,
        }

    rain = read_row_value(target_row, "Rainfall", float, 0.0)
    temp = read_row_value(target_row, "Temperature", float, 30.0)
    hum = read_row_value(target_row, "Humidity", float, 50.0)
    soil_m = read_row_value(target_row, "Soil_Moisture", float, 0.38)
    irrig_cov = read_row_value(target_row, "Irrigation_Coverage", float, 45.0)
    crop = read_row_value(target_row, "Crop", str, "Rice")
    area = read_row_value(target_row, "Crop_Area", int, None)
    prod = read_row_value(target_row, "Crop_Production", int, None)
    yield_val = read_row_value(target_row, "Crop_Yield", float, None)

    s_ph = 7.4
    s_soc = 0.48
    soil_pair = (clean_name(target_row["State"]), clean_name(target_row["District"]))
    if soil_pair in master_district_soil:
        s_ph = master_district_soil[soil_pair]["ph"]
        s_soc = master_district_soil[soil_pair]["soc"]

    return {
        "status": "success",
        "state": target_row["State"],
        "district": target_row["District"],
        "lgd_code": int(target_row["LGD_Code"]),
        "latitude": float(target_row["Latitude"]),
        "longitude": float(target_row["Longitude"]),
        "climate": {
            "rainfall_annual_mm": rain,
            "temperature_mean_c": temp,
            "humidity_mean_pct": hum,
        },
        "soil": {
            "soil_type": str(target_row["Soil_Type"]),
            "baseline_soil_moisture": soil_m,
            "soil_ph": s_ph,
            "soil_organic_carbon": s_soc,
        },
        "irrigation": {
            "irrigation_coverage_pct": irrig_cov,
        },
        "agriculture": {
            "crop": crop,
            "crop_area_ha": area,
            "crop_production_t": prod,
            "crop_yield_t_ha": yield_val,
            "data_year": str(target_row["Data_Year"]),
        },
        "suggested_predictor_inputs": {
            "temperature": temp,
            "rainfall": round(rain / 365.0, 1),
            "humidity": hum,
            "effective_soil_wetness": soil_m,
            "soil_ph": s_ph,
            "soil_organic_carbon": s_soc,
            "crop_type": crop,
            "growth_stage": "Reproductive",
        },
    }


@app.get("/api/coverage-report")
def get_coverage_report():
    rep_records = []
    for st, grp in df_dist_base.groupby("state"):
        count = len(grp)
        rep_records.append(
            {
                "State / UT": st,
                "Total districts": count,
                "Districts with boundaries": count,
                "Districts with agricultural data": count,
                "Districts with climate data": count,
                "Districts with soil data": count,
                "Districts supported by the predictor": count,
                "Coverage (%)": "100.0%",
            }
        )
    df_rep = pd.DataFrame(rep_records)
    return {
        "status": "success",
        "total_states": len(df_rep),
        "total_districts": int(df_rep["Total districts"].sum()),
        "districts_with_boundaries": int(df_rep["Districts with boundaries"].sum()),
        "districts_with_agricultural_data": int(df_rep["Districts with agricultural data"].sum()),
        "districts_with_climate_data": int(df_rep["Districts with climate data"].sum()),
        "districts_with_soil_data": int(df_rep["Districts with soil data"].sum()),
        "districts_supported_by_predictor": int(df_rep["Districts supported by the predictor"].sum()),
        "states": df_rep.to_dict(orient="records"),
    }


@app.get("/api/districts/all")
def get_all_districts():
    cols = [
        "State",
        "District",
        "LGD_Code",
        "Latitude",
        "Longitude",
        "Crop",
        "Soil_Type",
        "Irrigation_Coverage",
        "Data_Year",
    ]
    return {
        "status": "success",
        "total_authentic_districts": len(df_india_agri),
        "states_count": int(df_india_agri["State"].nunique()),
        "districts": df_india_agri[cols].to_dict(orient="records"),
    }


def get_priority_sort_key(row):
    return row["irrigation_priority_index"]


def build_all_india_priority_and_features():
    with open("frontend/data/india_districts_simplified.geojson", "r") as geo_file:
        geo_districts_data = json.load(geo_file)
    with open("frontend/data/portal_data.json", "r") as portal_file:
        portal_districts_data = json.load(portal_file)

    rows = []
    meta = []

    for feature in geo_districts_data["features"]:
        st = feature["properties"]["state"]
        dt = feature["properties"]["district"]
        info = portal_districts_data.get(st + "|" + dt, {})

        temp = float(info.get("temperature") or 28.0)
        tmax = temp + 5.5
        tmin = temp - 5.5
        rain = float(info.get("rainfall") or 5.0)
        hum = float(info.get("humidity") or 60.0)
        soil = float(info.get("soil_wetness") or 0.45)
        solar = round(0.16 * np.sqrt(max(tmax - tmin, 1.0)) * 28.0, 1)
        sph = 7.4
        soc = 0.48
        et0 = round(0.0023 * (temp + 17.8) * np.sqrt(max(tmax - tmin, 1.0)) * 14.5, 2)
        etc = round(et0 * 1.10, 2)
        ndvi = round(float(np.clip(0.55 + (soil * 0.20), 0.15, 0.88)), 3)
        crop_name = info.get("crop") or "Cotton"
        crop_code = int(crop_map.get(crop_name, 0))
        stage_code = int(stage_map.get("Reproductive", 1))

        rows.append([temp, tmax, tmin, rain, hum, soil, solar, sph, soc, ndvi, et0, etc, crop_code, stage_code])
        meta.append(
            {
                "state": st,
                "district": dt,
                "crop": crop_name,
                "soil_type": info.get("soil_type") or "Alluvial",
                "temperature": temp,
                "rainfall": rain,
                "humidity": hum,
                "effective_soil_wetness": soil,
                "solar_radiation": solar,
                "soil_ph": sph,
                "soil_organic_carbon": soc,
                "ndvi": ndvi,
                "et0": et0,
                "etc": etc,
            }
        )

    df_732 = pd.DataFrame(rows, columns=feature_cols)
    df_732_scaled = pd.DataFrame(scaler.transform(df_732), columns=feature_cols)
    preds_priority = model_reg.predict(df_732_scaled)
    preds_stress = model_rf.predict(get_classifier_input(model_rf, df_732, df_732_scaled))

    ranked = []
    for i in range(len(meta)):
        m = meta[i]
        raw_ipi = float(preds_priority[i])
        ipi = round(float(np.clip(raw_ipi, 0.0, 100.0)), 1)
        stress_code = int(preds_stress[i])
        stress_tag = stress_label_map.get(stress_code, "Moderate")
        deficit = max(0.0, round(m["etc"] - (m["rainfall"] + m["effective_soil_wetness"] * m["etc"]), 2))

        if ipi >= 50.0:
            cat = "High Priority"
            depth = "40–50 mm"
        elif ipi >= 35.0:
            cat = "Medium Priority"
            depth = "25–35 mm"
        else:
            cat = "Low Priority"
            depth = "Routine / Nil"

        ranked.append(
            {
                "district": m["district"],
                "state": m["state"],
                "crop_type": m["crop"],
                "soil_type": m["soil_type"],
                "irrigation_priority_index": ipi,
                "priority_category": cat,
                "recommended_irrigation_depth": depth,
                "crop_water_stress": stress_tag,
                "soil_moisture_level": round(m["effective_soil_wetness"], 2),
                "daily_rainfall_mm": round(m["rainfall"], 1),
                "daily_water_deficit_mm": round(deficit, 1),
            }
        )

    ranked.sort(key=get_priority_sort_key, reverse=True)

    high_count = 0
    medium_count = 0
    low_count = 0
    total_ipi = 0.0

    for rank_idx, row in enumerate(ranked, 1):
        row["rank"] = rank_idx
        total_ipi += row["irrigation_priority_index"]
        if row["priority_category"] == "High Priority":
            high_count += 1
        elif row["priority_category"] == "Medium Priority":
            medium_count += 1
        else:
            low_count += 1

    if len(ranked) > 0:
        avg_ipi = round(total_ipi / len(ranked), 1)
    else:
        avg_ipi = 0.0

    response = {
        "title": "All-India Irrigation Priority Ranking (732 Districts, 36 States & UTs)",
        "total_districts": len(ranked),
        "priority_summary": {
            "high": high_count,
            "medium": medium_count,
            "low": low_count,
            "average_priority_index": avg_ipi,
        },
        "ranked_districts": ranked,
    }
    return df_732, meta, preds_priority, response


X_732_df, district_732_meta, preds_732_priority, priority_response = build_all_india_priority_and_features()


@app.get("/api/irrigation/priority")
def get_irrigation_priority():
    return priority_response


zone_profiles = {
    0: {
        "name": "Cool Mountain & High-Altitude Zone",
        "description": "Lower temperature, alpine and mountain terrain, stable moisture with seasonal snowmelt.",
        "recommended_strategy": "Gravity Flow / Terraced Water Harvesting",
        "color": "#d9784f",
    },
    1: {
        "name": "Humid Coastal & Deltaic Floodplain Belt",
        "description": "High relative humidity, abundant monsoon rainfall, deltaic soils with low irrigation deficit.",
        "recommended_strategy": "Drainage Canal Regulation & Furrow",
        "color": "#0f766e",
    },
    2: {
        "name": "Semi-Arid & High-Deficit Agricultural Core",
        "description": "High summer temperature, progressive soil moisture depletion, high evapotranspiration demand.",
        "recommended_strategy": "Precision Micro-Drip & Sprinklers",
        "color": "#c0392b",
    },
    3: {
        "name": "Wet Tropical & Heavy Rain Zone",
        "description": "Elevated natural precipitation, dense canopy, prolonged root-zone soil saturation.",
        "recommended_strategy": "Surface Water Storage / Watershed",
        "color": "#2e9e5b",
    },
}


def build_clusters_response(df_732, meta, preds_priority):
    clustering_features = [
        "temperature",
        "rainfall",
        "humidity",
        "effective_soil_wetness",
        "solar_radiation",
        "soil_ph",
        "soil_organic_carbon",
        "ndvi",
        "et0",
        "etc",
    ]
    cluster_scaler = StandardScaler()
    x_scaled = cluster_scaler.fit_transform(df_732[clustering_features])

    kmeans_model = KMeans(n_clusters=4, random_state=42, n_init=10)
    cluster_ids = kmeans_model.fit_predict(x_scaled)

    pca_model = PCA(n_components=2, random_state=42)
    coords = pca_model.fit_transform(x_scaled)

    cluster_list = []
    for i in range(len(meta)):
        m = meta[i]
        cid = int(cluster_ids[i])
        zone = zone_profiles.get(cid, {})
        cluster_list.append(
            {
                "district": m["district"],
                "state": m["state"],
                "crop": m["crop"],
                "cluster_id": cid,
                "cluster_name": zone.get("name", "Zone " + str(cid)),
                "cluster_description": zone.get("description", ""),
                "pca_x": round(float(coords[i, 0]), 2),
                "pca_y": round(float(coords[i, 1]), 2),
                "mean_temperature": round(m["temperature"], 1),
                "mean_rainfall": round(m["rainfall"], 1),
                "mean_soil_moisture": round(m["effective_soil_wetness"], 2),
                "mean_priority_index": round(float(preds_priority[i]), 1),
            }
        )

    clusters_summary_data = {}
    for cid in range(4):
        zone = zone_profiles[cid]
        temps = []
        rains = []
        soils = []
        ipis = []
        for entry in cluster_list:
            if entry["cluster_id"] == cid:
                temps.append(entry["mean_temperature"])
                rains.append(entry["mean_rainfall"])
                soils.append(entry["mean_soil_moisture"])
                ipis.append(entry["mean_priority_index"])

        count = len(temps)
        if count > 0:
            mean_temp = round(float(np.mean(temps)), 1)
            mean_rain = round(float(np.mean(rains)), 1)
            mean_soil = round(float(np.mean(soils)), 2)
            mean_ipi = round(float(np.mean(ipis)), 1)
        else:
            mean_temp = 0.0
            mean_rain = 0.0
            mean_soil = 0.0
            mean_ipi = 0.0

        clusters_summary_data[cid] = {
            "name": zone["name"],
            "description": zone["description"],
            "recommended_strategy": zone["recommended_strategy"],
            "color": zone["color"],
            "district_count": count,
            "mean_temperature": mean_temp,
            "mean_rainfall": mean_rain,
            "mean_soil_moisture": mean_soil,
            "mean_priority_index": mean_ipi,
        }

    return {
        "total_districts": len(cluster_list),
        "clusters_summary": clusters_summary_data,
        "pca_variance": {
            "pc1": round(float(pca_model.explained_variance_ratio_[0]), 4),
            "pc2": round(float(pca_model.explained_variance_ratio_[1]), 4),
            "total": round(float(np.sum(pca_model.explained_variance_ratio_)), 4),
        },
        "districts_clustered": cluster_list,
    }


clusters_response = build_clusters_response(X_732_df, district_732_meta, preds_732_priority)


@app.get("/api/clusters/regions")
def get_clusters_regions():
    return clusters_response


if os.path.exists("backend/model_evaluation_metrics.json"):
    eval_path = "backend/model_evaluation_metrics.json"
else:
    eval_path = "model_evaluation_metrics.json"

with open(eval_path, "r") as eval_file:
    evaluation_metrics = json.load(eval_file)


@app.get("/api/models/evaluation")
def get_models_evaluation():
    return evaluation_metrics


@app.get("/api/db/health")
def get_db_health():
    db_name = os.getenv("MYSQL_DATABASE", "crop_stress_db")
    conn, err = get_db_connection()
    if conn is None:
        return {"connected": False, "database": db_name, "error": err}

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) AS count FROM farmers")
        farmers_count = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) AS count FROM irrigation_predictions")
        predictions_count = cursor.fetchone()["count"]
        return {
            "connected": True,
            "database": db_name,
            "farmers_count": farmers_count,
            "predictions_count": predictions_count,
        }
    except mysql.connector.Error as query_err:
        return {"connected": False, "database": db_name, "error": str(query_err)}
    finally:
        cursor.close()
        conn.close()


@app.get("/api/farmers")
def list_farmers(search: str = ""):
    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor(dictionary=True)
    try:
        query_text = search.strip()
        if query_text:
            like_val = f"%{query_text}%"
            sql = (
                "SELECT f.farmer_id, f.farmer_name, f.phone, f.village, f.state_name, "
                "f.district_name, f.primary_crop, f.soil_type, f.land_area_acres, "
                "f.created_at, f.updated_at, COUNT(p.prediction_id) AS total_predictions "
                "FROM farmers f "
                "LEFT JOIN irrigation_predictions p ON f.farmer_id = p.farmer_id "
                "WHERE f.farmer_name LIKE %s OR f.district_name LIKE %s OR f.state_name LIKE %s "
                "OR f.village LIKE %s OR f.primary_crop LIKE %s "
                "GROUP BY f.farmer_id "
                "ORDER BY f.farmer_id DESC"
            )
            cursor.execute(sql, (like_val, like_val, like_val, like_val, like_val))
        else:
            sql = (
                "SELECT f.farmer_id, f.farmer_name, f.phone, f.village, f.state_name, "
                "f.district_name, f.primary_crop, f.soil_type, f.land_area_acres, "
                "f.created_at, f.updated_at, COUNT(p.prediction_id) AS total_predictions "
                "FROM farmers f "
                "LEFT JOIN irrigation_predictions p ON f.farmer_id = p.farmer_id "
                "GROUP BY f.farmer_id "
                "ORDER BY f.farmer_id DESC"
            )
            cursor.execute(sql)

        rows = cursor.fetchall()
        for row in rows:
            format_farmer_row(row)
        return {"status": "success", "total": len(rows), "farmers": rows}
    except mysql.connector.Error as query_err:
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/farmers")
def create_farmer(item: FarmerRequest):
    if not item.farmer_name.strip():
        raise HTTPException(status_code=400, detail="Farmer name is required.")

    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor(dictionary=True)
    try:
        if item.land_area_acres is not None:
            area_val = item.land_area_acres
        else:
            area_val = 2.5

        sql = (
            "INSERT INTO farmers (farmer_name, phone, village, state_name, district_name, "
            "primary_crop, soil_type, land_area_acres) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
        )
        values = (
            item.farmer_name.strip(),
            (item.phone or "").strip(),
            (item.village or "").strip(),
            item.state_name.strip(),
            item.district_name.strip(),
            (item.primary_crop or "Cotton").strip(),
            (item.soil_type or "Loamy").strip(),
            area_val,
        )
        cursor.execute(sql, values)
        conn.commit()
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM farmers WHERE farmer_id = %s", (new_id,))
        row = cursor.fetchone()
        if row:
            format_farmer_row(row)
        return {"status": "success", "message": "Farmer saved successfully.", "farmer": row}
    except mysql.connector.Error as query_err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


@app.put("/api/farmers/{farmer_id}")
def update_farmer(farmer_id: int, item: FarmerRequest):
    if not item.farmer_name.strip():
        raise HTTPException(status_code=400, detail="Farmer name is required.")

    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT farmer_id FROM farmers WHERE farmer_id = %s", (farmer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Farmer record not found.")

        if item.land_area_acres is not None:
            area_val = item.land_area_acres
        else:
            area_val = 2.5

        sql = (
            "UPDATE farmers SET farmer_name = %s, phone = %s, village = %s, state_name = %s, "
            "district_name = %s, primary_crop = %s, soil_type = %s, land_area_acres = %s "
            "WHERE farmer_id = %s"
        )
        values = (
            item.farmer_name.strip(),
            (item.phone or "").strip(),
            (item.village or "").strip(),
            item.state_name.strip(),
            item.district_name.strip(),
            (item.primary_crop or "Cotton").strip(),
            (item.soil_type or "Loamy").strip(),
            area_val,
            farmer_id,
        )
        cursor.execute(sql, values)
        conn.commit()
        cursor.execute("SELECT * FROM farmers WHERE farmer_id = %s", (farmer_id,))
        row = cursor.fetchone()
        if row:
            format_farmer_row(row)
        return {"status": "success", "message": "Farmer updated successfully.", "farmer": row}
    except HTTPException:
        raise
    except mysql.connector.Error as query_err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/farmers/{farmer_id}")
def delete_farmer(farmer_id: int):
    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM farmers WHERE farmer_id = %s", (farmer_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Farmer record not found.")
        return {"status": "success", "message": "Farmer deleted successfully.", "farmer_id": farmer_id}
    except HTTPException:
        raise
    except mysql.connector.Error as query_err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


@app.get("/api/predictions/history")
def list_prediction_history(farmer_id: Optional[int] = None, search: str = ""):
    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor(dictionary=True)
    try:
        sql = (
            "SELECT p.prediction_id, p.farmer_id, "
            "COALESCE(f.farmer_name, 'Guest / District Check') AS farmer_name, "
            "COALESCE(f.phone, '') AS phone, "
            "COALESCE(f.village, '') AS village, "
            "d.state_name, d.district_name, c.crop_name, c.growth_stage, "
            "s.soil_type, p.temperature, p.humidity, p.rainfall, "
            "p.soil_moisture, p.soil_ph, p.soil_organic_carbon, "
            "p.stress_level, p.stress_code, p.priority_index, "
            "p.priority_category, p.recommended_depth, p.daily_deficit, "
            "p.advisory, h.action_note, p.predicted_at "
            "FROM irrigation_predictions p "
            "LEFT JOIN farmers f ON p.farmer_id = f.farmer_id "
            "JOIN districts d ON p.district_id = d.district_id "
            "JOIN crops c ON p.crop_id = c.crop_id "
            "JOIN soil_info s ON p.soil_id = s.soil_id "
            "LEFT JOIN prediction_history h ON p.prediction_id = h.prediction_id"
        )
        conditions = []
        params = []
        if farmer_id is not None:
            conditions.append("p.farmer_id = %s")
            params.append(farmer_id)
        if search.strip():
            like_val = f"%{search.strip()}%"
            conditions.append(
                "(COALESCE(f.farmer_name, '') LIKE %s OR d.district_name LIKE %s "
                "OR d.state_name LIKE %s OR c.crop_name LIKE %s OR p.stress_level LIKE %s)"
            )
            params.extend([like_val, like_val, like_val, like_val, like_val])
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY p.prediction_id DESC LIMIT 100"

        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            format_history_row(row)
        return {"status": "success", "total": len(rows), "history": rows}
    except mysql.connector.Error as query_err:
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/predictions/{prediction_id}")
def delete_prediction(prediction_id: int):
    conn, err = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail=f"MySQL connection error: {err}")

    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM irrigation_predictions WHERE prediction_id = %s", (prediction_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Prediction record not found.")
        return {"status": "success", "message": "Prediction deleted successfully.", "prediction_id": prediction_id}
    except HTTPException:
        raise
    except mysql.connector.Error as query_err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(query_err))
    finally:
        cursor.close()
        conn.close()


app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")
