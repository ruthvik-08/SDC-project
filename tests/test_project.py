import os
import sys
import pandas as pd
from fastapi.testclient import TestClient

if "." not in sys.path:
    sys.path.insert(0, ".")

from backend.main import (
    app,
    feature_cols,
    scaler,
    model_rf,
    model_dt,
    model_knn,
    model_poly_deficit,
    model_poly_priority,
)

client = TestClient(app)


def test_1_master_dataset_loading():
    print("\n[Test 1] Testing Master Dataset Loading & Integrity...")
    master_path = "data/processed/krishijal_master_dataset.csv"
    assert os.path.exists(master_path), f"Master dataset not found at {master_path}"

    df = pd.read_csv(master_path)
    assert len(df) in [6654, 7386], f"Expected 6,654 or 7,386 rows, got {len(df)}"
    assert len(df.columns) == 72, f"Expected 72 columns, got {len(df.columns)}"
    assert "shc_macro_nitrogen_low_share_2024_25" in df.columns
    assert "soil_health_index" in df.columns
    assert df["district"].nunique() >= 158
    assert df["state"].nunique() >= 36
    assert "granularity" in df.columns

    allowed_granularities = {"daily", "monthly", "district_baseline"}
    assert set(df["granularity"].unique()).issubset(allowed_granularities)

    dup_count = df.duplicated(subset=["granularity", "state", "district", "month", "date"]).sum()
    assert dup_count == 0, f"Found {dup_count} duplicate records"

    print(
        f"  -> PASSED: Loaded {len(df)} records across {df['district'].nunique()} districts "
        f"in {df['state'].nunique()} States & UTs."
    )


def test_2_data_preprocessing_and_bounds():
    print("\n[Test 2] Testing Data Preprocessing & Agronomic Physical Bounds...")
    df = pd.read_csv("data/processed/krishijal_master_dataset.csv")

    required_cols = [
        "temperature", "temp_max", "temp_min", "rainfall", "humidity",
        "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
        "effective_soil_wetness", "et0", "etc", "cwsi", "water_deficit", "ndvi",
        "irrigation_priority_index", "stress_level", "stress_level_code",
        "shc_macro_nitrogen_low_share_2024_25", "soil_health_index",
    ]
    for col in required_cols:
        null_count = df[col].isnull().sum()
        assert null_count == 0, f"Found {null_count} nulls in '{col}'"

    assert (df["root_zone_soil_moisture"] >= 0.0).all()
    assert (df["effective_soil_wetness"] >= 0.0).all()
    assert (df["effective_soil_wetness"] <= 1.0).all()
    assert (df["cwsi"] >= 0.0).all()
    assert (df["cwsi"] <= 1.0).all()
    assert (df["ndvi"] >= 0.10).all()
    assert (df["ndvi"] <= 1.0).all()
    assert (df["irrigation_priority_index"] >= 0.0).all()
    assert (df["irrigation_priority_index"] <= 100.0).all()
    assert (df["water_deficit"] >= 0.0).all()

    valid_stress = {"Low", "Moderate", "High", "Severe"}
    assert set(df["stress_level"].unique()).issubset(valid_stress)

    print("  -> PASSED: All agronomic bounds verified with 0 anomalies.")


def test_3_in_memory_models():
    print("\n[Test 3] Testing Trained Models & Scalers...")
    assert scaler is not None
    assert model_rf is not None
    assert model_dt is not None
    assert model_knn is not None
    assert model_poly_priority is not None
    assert model_poly_deficit is not None
    print("  -> PASSED: All ML models and scalers verified.")


def test_4_model_predictions():
    print("\n[Test 4] Testing Model Inferences...")
    sample_row = [32.0, 38.0, 24.0, 0.0, 45.0, 0.35, 21.0, 7.8, 0.45, 0.65, 5.2, 5.8, 1, 2]
    features_df = pd.DataFrame([sample_row], columns=feature_cols)
    scaled_values = scaler.transform(features_df)
    scaled_df = pd.DataFrame(scaled_values, columns=feature_cols)

    pred_rf = model_rf.predict(scaled_df)[0]
    pred_dt = model_dt.predict(scaled_df)[0]
    pred_knn = model_knn.predict(scaled_df)[0]

    assert pred_rf in [0, 1, 2, 3]
    assert pred_dt in [0, 1, 2, 3]
    assert pred_knn in [0, 1, 2, 3]

    pred_priority = model_poly_priority.predict(scaled_df)[0]
    pred_deficit = model_poly_deficit.predict(scaled_df)[0]

    assert 0.0 <= pred_priority <= 100.0
    assert pred_deficit >= 0.0

    print(
        f"  -> PASSED: Inferences verified (Class: {pred_rf}, "
        f"Priority: {pred_priority:.2f}, Deficit: {pred_deficit:.2f} mm/day)."
    )


def verify_mysql_crud_if_connected():
    res_db = client.get("/api/db/health")
    assert res_db.status_code == 200
    db_info = res_db.json()
    assert "connected" in db_info

    if not db_info.get("connected"):
        return

    res_hist = client.get("/api/predictions/history")
    assert res_hist.status_code == 200
    assert res_hist.json()["status"] == "success"

    create_payload = {
        "farmer_name": "Pytest Automated Check",
        "phone": "9000000000",
        "village": "Test Village",
        "state_name": "Telangana",
        "district_name": "Khammam",
        "primary_crop": "Cotton",
        "soil_type": "Loamy",
        "land_area_acres": 3.0,
    }
    res_create = client.post("/api/farmers", json=create_payload)
    assert res_create.status_code == 200
    farmer_id = res_create.json()["farmer"]["farmer_id"]

    update_payload = {
        "farmer_name": "Pytest Automated Updated",
        "phone": "9000000001",
        "village": "Test Village",
        "state_name": "Telangana",
        "district_name": "Khammam",
        "primary_crop": "Rice",
        "soil_type": "Alluvial",
        "land_area_acres": 4.0,
    }
    res_update = client.put(f"/api/farmers/{farmer_id}", json=update_payload)
    assert res_update.status_code == 200

    res_delete = client.delete(f"/api/farmers/{farmer_id}")
    assert res_delete.status_code == 200


def verify_prediction_endpoints():
    payload_14 = {
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
        "et0": 5.0,
        "etc": 5.5,
        "crop_type": "Cotton",
        "growth_stage": "Reproductive",
    }
    r_p14 = client.post("/predict", json=payload_14)
    assert r_p14.status_code == 200
    data_14 = r_p14.json()
    assert data_14["status"] == "success"
    assert data_14["crop_stress_prediction"]["stress_level"] in ["Low", "Moderate", "High", "Severe"]
    assert 0.0 <= data_14["irrigation_priority_prediction"]["irrigation_priority_index"] <= 100.0

    pred_id = data_14.get("database", {}).get("prediction_id")
    if pred_id:
        client.delete(f"/api/predictions/{pred_id}")

    payload_readonly = dict(payload_14)
    payload_readonly["save_history"] = False
    r_ro = client.post("/predict", json=payload_readonly)
    assert r_ro.status_code == 200
    assert r_ro.json()["database"]["saved"] is False
    assert r_ro.json()["database"]["prediction_id"] is None

    payload_9 = {
        "cwsi": 0.35,
        "effective_soil_wetness": 0.40,
        "water_deficit": 1.50,
        "ndvi": 0.60,
        "et0": 4.80,
        "etc": 5.20,
        "temperature": 30.0,
        "rainfall": 0.0,
        "humidity": 50.0,
    }
    r_p9 = client.post("/predict", json=payload_9)
    assert r_p9.status_code == 200
    data_9 = r_p9.json()
    assert data_9["status"] == "success"

    pred_id_9 = data_9.get("database", {}).get("prediction_id")
    if pred_id_9:
        client.delete(f"/api/predictions/{pred_id_9}")

    assert client.get("/predict").status_code == 405

    sim_payload = {
        "temperature": 34.0,
        "temp_max": 40.0,
        "temp_min": 26.0,
        "rainfall": 0.0,
        "humidity": 32.0,
        "effective_soil_wetness": 0.28,
        "solar_radiation": 23.0,
        "soil_ph": 8.1,
        "soil_organic_carbon": 0.35,
        "crop_type": "Cotton",
        "growth_stage": "Reproductive",
        "selected_model": "Random Forest",
    }
    r_sim = client.post("/api/predict/crop-stress", json=sim_payload)
    assert r_sim.status_code == 200
    sim_data = r_sim.json()
    assert sim_data["crop_stress_level"] in ["Low", "Moderate", "High", "Severe"]
    assert "recommendation" in sim_data

    pri_payload = {
        "cwsi": 0.45,
        "effective_soil_wetness": 0.30,
        "water_deficit": 2.2,
        "ndvi": 0.50,
        "et0": 5.0,
        "etc": 5.5,
        "temperature": 33.0,
        "rainfall": 0.0,
        "humidity": 40.0,
    }
    r_pri = client.post("/api/predict/irrigation-priority", json=pri_payload)
    assert r_pri.status_code == 200
    assert 0.0 <= r_pri.json()["irrigation_priority_index"] <= 100.0


def test_5_api_endpoints():
    print("\n[Test 5] Testing FastAPI REST Endpoints...")
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["status"] == "Online and Operational"

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"
    assert r_health.json()["models_loaded"]["crop_stress_classifier"] is True
    assert r_health.json()["models_loaded"]["irrigation_priority_regressor"] is True
    assert r_health.json()["models_loaded"]["feature_scaler"] is True

    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200

    r_info = client.get("/api/dataset/info")
    assert r_info.status_code == 200
    assert r_info.json()["total_records"] in [6654, 7386]

    assert len(client.get("/api/districts").json()["districts"]) >= 158
    assert len(client.get("/api/clusters/regions").json()["districts_clustered"]) >= 158
    assert len(client.get("/api/irrigation/priority").json()["ranked_districts"]) >= 158

    r_eval = client.get("/api/models/evaluation")
    assert r_eval.status_code == 200
    eval_data = r_eval.json()
    assert eval_data["best_classifier"] == "Random Forest Classifier"
    assert eval_data["classification"]["Random Forest Classifier"]["accuracy"] == 0.9955
    assert eval_data["best_regressor"] == "Random Forest Regressor"
    assert eval_data["regression"]["Random Forest Regressor"]["r2_score"] == 0.9952

    r_prof = client.get("/api/district-profile?state=Telangana&district=Karimnagar")
    assert r_prof.status_code == 200
    assert r_prof.json()["lgd_code"] == 508

    assert client.get("/api/coverage-report").json()["total_districts"] >= 700
    assert client.get("/api/districts/all").json()["total_authentic_districts"] >= 700

    verify_mysql_crud_if_connected()
    verify_prediction_endpoints()
    print("  -> PASSED: All REST endpoints, MySQL CRUD checks, and predictions returned HTTP 200.")


def test_6_invalid_inputs_and_edge_cases():
    print("\n[Test 6] Testing Edge Cases & Error Handling...")
    edge_payload = {
        "temperature": 28.0,
        "temp_max": 32.0,
        "temp_min": 22.0,
        "rainfall": 5.0,
        "humidity": 70.0,
        "effective_soil_wetness": 0.65,
        "solar_radiation": 18.0,
        "soil_ph": 7.0,
        "soil_organic_carbon": 0.50,
        "crop_type": "ExoticDragonFruit",
        "growth_stage": "UnknownStage",
        "selected_model": "Random Forest",
    }
    assert client.post("/api/predict/crop-stress", json=edge_payload).status_code == 200

    invalid_payload = {"temperature": "hot_day", "crop_type": "Rice"}
    assert client.post("/api/predict/crop-stress", json=invalid_payload).status_code == 422
    print("  -> PASSED: Edge cases and 422 validation checks verified.")


def test_7_irrigation_priority_logic():
    print("\n[Test 7] Testing Irrigation Priority Ranking Logic...")
    districts = client.get("/api/irrigation/priority").json()["ranked_districts"]

    scores = []
    ranks = []
    for item in districts:
        scores.append(item["irrigation_priority_index"])
        ranks.append(item["rank"])

    assert scores == sorted(scores, reverse=True)
    assert ranks == list(range(1, len(districts) + 1))
    print(f"  -> PASSED: Priority ranking verified across {len(districts)} districts.")


def test_8_frontend_integrity():
    print("\n[Test 8] Testing Active 6-Module Frontend Files Integrity...")
    required_files = [
        "frontend/index.html",
        "frontend/portal.css",
        "frontend/portal.js",
        "frontend/data/portal_data.json",
        "frontend/data/india_states_simplified.geojson",
        "frontend/data/india_districts_simplified.geojson",
    ]
    for path in required_files:
        assert os.path.exists(path), f"Missing {path}"

    with open("frontend/index.html", "r") as f:
        html = f.read()
    required_html_tokens = [
        "view-home", 'id="app"', "view-predictor", "view-ranking",
        "view-benchmarks", "view-clusters", "view-farmers",
        "hero-shortcut", "nav-card",
        "#/map", "#/predictor", "#/ranking", "#/benchmarks", "#/clusters", "#/farmers",
        "btn-back-india", "btn-back-state", "map-legend", "map-tooltip",
        "layer-dock", 'data-style="dark"', 'data-style="light"', 'data-style="satellite"',
    ]
    for token in required_html_tokens:
        assert token in html, f"Missing {token} in frontend/index.html"

    with open("frontend/portal.js", "r") as f:
        js = f.read()
    required_js_tokens = [
        "module-dock", "selectDistrict", "runPredictionInference", "loadPriorityData",
        "loadModelBenchmarks", "loadClustersData", "initFarmersView", "initModuleDocks",
        "setActiveLayer", "filterByState", "backToParentState", "fetchDistrictMlIntelligence",
        "renderDynamicLegend",
    ]
    for token in required_js_tokens:
        assert token in js, f"Missing {token} in frontend/portal.js"

    print("  -> PASSED: Active 6-module frontend assets verified.")


if __name__ == "__main__":
    print("=" * 80)
    print("AUTOMATED TESTING SUITE (KRISHIJAL DECISION SUPPORT SYSTEM)")
    print("=" * 80)
    test_1_master_dataset_loading()
    test_2_data_preprocessing_and_bounds()
    test_3_in_memory_models()
    test_4_model_predictions()
    test_5_api_endpoints()
    test_6_invalid_inputs_and_edge_cases()
    test_7_irrigation_priority_logic()
    test_8_frontend_integrity()
    print("\n" + "=" * 80)
    print("ALL 8 STAGES OF TEST SUITE PASSED SUCCESSFULLY! (100% PASS RATE)")
    print("=" * 80)
