"""
Stage 14: Comprehensive Automated Test Suite
Updated for Single Master Dataset Pipeline: data/processed/krishijal_master_dataset.csv
Author: First-Year B.Tech Student Project
Tests:
 1. Master Dataset Loading & Schema Integrity (6,654 rows, 48 columns)
 2. Agronomic Bounds & Data Quality (CWSI, NDVI, IPI, Soil Wetness [0, 1], No -999 anomalies)
 3. In-Memory ML Models & Transformers Verification
 4. Model Predictions (Classification, Regression, Clustering, PCA)
 5. FastAPI Backend Endpoints (All 7 REST routes return HTTP 200 OK)
 6. Error Handling, Invalid Inputs, and Edge Cases
 7. Irrigation Priority Sorting and Ranking Logic (Descending order)
 8. Frontend Static Files Integrity (HTML, CSS, JS)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import FastAPI app from backend
from backend.main import app, feature_cols, scaler, model_rf, model_dt, model_knn, model_poly_deficit, model_poly_priority

# Initialize TestClient
client = TestClient(app)

print("=" * 80)
print("STAGE 14: AUTOMATED TESTING SUITE (KRISHIJAL MASTER DATASET PIPELINE)")
print("=" * 80)

def test_1_master_dataset_loading():
    print("\n[Test 1] Testing Master Dataset Loading & Integrity...")
    master_path = "data/processed/krishijal_master_dataset.csv"
    assert os.path.exists(master_path), f"Master dataset not found at {master_path}"
    
    df = pd.read_csv(master_path)
    assert len(df) == 6654, f"Expected 6,654 rows, got {len(df)}"
    assert len(df.columns) == 72, f"Expected 72 columns (48 master + 24 SHC 2025 features), got {len(df.columns)}"
    assert "shc_macro_nitrogen_low_share_2024_25" in df.columns, "Missing Soil Health Card features"
    assert "soil_health_index" in df.columns, "Missing soil_health_index"
    assert df["district"].nunique() >= 158, f"Expected >= 158 districts, got {df['district'].nunique()}"
    assert df["state"].nunique() >= 36, f"Expected >= 36 states/UTs, got {df['state'].nunique()}"
    assert "granularity" in df.columns, "Missing 'granularity' column in master dataset"
    assert set(df["granularity"].unique()) == {"daily", "monthly"}, "Invalid granularity values"
    
    # Check duplicate records
    dup_count = df.duplicated(subset=["granularity", "state", "district", "month", "date"]).sum()
    assert dup_count == 0, f"Found {dup_count} duplicate records in master dataset!"
    
    print(f"  -> PASSED: Loaded master dataset with {len(df)} records across {df['district'].nunique()} districts in {df['state'].nunique()} States & UTs (0 duplicates).")

def test_2_data_preprocessing_and_bounds():
    print("\n[Test 2] Testing Data Preprocessing & Agronomic Physical Bounds...")
    df = pd.read_csv("data/processed/krishijal_master_dataset.csv")
    
    # Check that meteorological and core calculated features have 0 nulls
    core_cols = [
        "temperature", "temp_max", "temp_min", "rainfall", "humidity",
        "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
        "effective_soil_wetness", "et0", "etc", "cwsi", "water_deficit", "ndvi",
        "irrigation_priority_index", "stress_level", "stress_level_code",
        "shc_macro_nitrogen_low_share_2024_25", "soil_health_index"
    ]
    for col in core_cols:
        null_count = df[col].isnull().sum()
        assert null_count == 0, f"Found {null_count} nulls in core column '{col}'!"
        
    # Check for absence of NASA -999 fill values
    assert (df["root_zone_soil_moisture"] >= 0.0).all(), "Negative soil moisture values detected (uncleaned -999 anomalies)!"
    assert (df["effective_soil_wetness"] >= 0.0).all() and (df["effective_soil_wetness"] <= 1.0).all(), "Effective soil wetness out of [0, 1] bounds!"
    
    # Physical bounds checks
    assert (df["cwsi"] >= 0.0).all() and (df["cwsi"] <= 1.0).all(), "CWSI out of [0, 1] bounds!"
    assert (df["ndvi"] >= 0.10).all() and (df["ndvi"] <= 1.0).all(), "NDVI out of valid vegetation bounds!"
    assert (df["irrigation_priority_index"] >= 0.0).all() and (df["irrigation_priority_index"] <= 100.0).all(), "IPI out of [0, 100] bounds!"
    assert (df["water_deficit"] >= 0.0).all(), "Water deficit cannot be negative!"
    
    # Check categorical labels
    valid_stress = {"Low", "Moderate", "High", "Severe"}
    assert set(df["stress_level"].unique()).issubset(valid_stress), "Invalid stress level categories found!"
    
    print("  -> PASSED: All agronomic bounds (CWSI, NDVI, IPI, Soil Wetness) verified with 0 anomalies.")

def test_3_in_memory_models():
    print("\n[Test 3] Testing In-Memory Trained Models & Scalers...")
    assert scaler is not None, "StandardScaler is not initialized!"
    assert model_rf is not None, "Random Forest model is not initialized!"
    assert model_dt is not None, "Decision Tree model is not initialized!"
    assert model_knn is not None, "KNN model is not initialized!"
    assert model_poly_priority is not None, "Polynomial priority model is not initialized!"
    assert model_poly_deficit is not None, "Polynomial deficit model is not initialized!"
    
    print("  -> PASSED: All in-memory Scikit-Learn models and transformers successfully verified in RAM.")

def test_4_model_predictions():
    print("\n[Test 4] Testing Model Inferences...")
    # Sample synthetic agro-meteorological feature vector (14 features)
    sample_raw = [32.0, 38.0, 24.0, 0.0, 45.0, 0.35, 21.0, 7.8, 0.45, 0.65, 5.2, 5.8, 1, 2]
    features_df = pd.DataFrame([sample_raw], columns=feature_cols)
    scaled_x = scaler.transform(features_df)
    
    # Test classifiers
    pred_rf = model_rf.predict(scaled_x)[0]
    pred_dt = model_dt.predict(scaled_x)[0]
    pred_knn = model_knn.predict(scaled_x)[0]
    
    assert pred_rf in [0, 1, 2, 3], f"Invalid RF class prediction: {pred_rf}"
    assert pred_dt in [0, 1, 2, 3], f"Invalid DT class prediction: {pred_dt}"
    assert pred_knn in [0, 1, 2, 3], f"Invalid KNN class prediction: {pred_knn}"
    
    # Test regression
    pred_pri = model_poly_priority.predict(scaled_x)[0]
    pred_def = model_poly_deficit.predict(scaled_x)[0]
    
    assert 0.0 <= pred_pri <= 100.0, f"Irrigation Priority Index out of range: {pred_pri}"
    assert pred_def >= 0.0, f"Water deficit cannot be negative: {pred_def}"
    
    print(f"  -> PASSED: Inferences verified (RF Class: {pred_rf}, Priority Index: {pred_pri:.2f}, Deficit: {pred_def:.2f} mm/day).")

def test_5_api_endpoints():
    print("\n[Test 5] Testing FastAPI REST Endpoints...")
    
    # Root Health Route
    r0 = client.get("/")
    assert r0.status_code == 200
    res0 = r0.json()
    assert res0["status"] == "Online and Operational"
    assert res0["districts_covered"] >= 158
    assert res0["states_covered"] >= 36
    
    # Dataset Info
    r1 = client.get("/api/dataset/info")
    assert r1.status_code == 200
    res1 = r1.json()
    assert res1["total_records"] == 6654
    assert res1["total_districts"] >= 158
    assert res1["total_states"] >= 36
    
    # Districts Directory
    r2 = client.get("/api/districts")
    assert r2.status_code == 200
    assert len(r2.json()["districts"]) >= 158
    
    # Regional Clusters
    r3 = client.get("/api/clusters/regions")
    assert r3.status_code == 200
    assert len(r3.json()["districts_clustered"]) >= 158
    
    # Irrigation Priority
    r4 = client.get("/api/irrigation/priority")
    assert r4.status_code == 200
    assert len(r4.json()["ranked_districts"]) >= 158
    
    # Model Evaluation Benchmarks
    r5 = client.get("/api/models/evaluation")
    assert r5.status_code == 200
    assert "classification" in r5.json()
    
    # Live ML Prediction POST
    payload = {
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
        "selected_model": "Random Forest"
    }
    r6 = client.post("/api/predict/crop-stress", json=payload)
    assert r6.status_code == 200
    res6 = r6.json()
    assert res6["crop_stress_level"] in ["Low", "Moderate", "High", "Severe"]
    assert "recommendation" in res6
    assert "predicted_water_deficit_mm_per_day" in res6
    assert "irrigation_priority_index" in res6
    
    print(f"  -> PASSED: All 7 REST API endpoints returned 200 OK across {res1['total_districts']} districts.")

def test_6_invalid_inputs_and_edge_cases():
    print("\n[Test 6] Testing Edge Cases & Error Handling...")
    
    # Edge case 1: Unknown crop type and unknown growth stage (should gracefully fallback)
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
        "selected_model": "Random Forest"
    }
    r_edge = client.post("/api/predict/crop-stress", json=edge_payload)
    assert r_edge.status_code == 200, "API should safely handle unknown crop with fallback encoding"
    
    # Edge case 2: Invalid data type payload (string for temperature)
    invalid_payload = {
        "temperature": "hot_day",
        "crop_type": "Rice"
    }
    r_inv = client.post("/api/predict/crop-stress", json=invalid_payload)
    assert r_inv.status_code == 422, "API should return HTTP 422 Unprocessable Entity for invalid types"
    
    print("  -> PASSED: Robust error handling verified for unseen categories and 422 schema validation.")

def test_7_irrigation_priority_logic():
    print("\n[Test 7] Testing Irrigation Priority Ranking Logic...")
    r = client.get("/api/irrigation/priority")
    districts = r.json()["ranked_districts"]
    
    # Check that districts are sorted descending by Irrigation Priority Index
    scores = [d["irrigation_priority_index"] for d in districts]
    assert scores == sorted(scores, reverse=True), "Districts are not properly sorted descending by priority!"
    
    # Check that ranks are 1 to N
    ranks = [d["rank"] for d in districts]
    assert ranks == list(range(1, len(districts) + 1)), "Ranks must be strictly sequential 1 to N"
    
    print(f"  -> PASSED: Irrigation priority table verified ({len(districts)} districts in strict descending rank order).")

def test_8_frontend_integrity():
    print("\n[Test 8] Testing Frontend Files Integrity...")
    assert os.path.exists("frontend/index.html"), "Missing frontend/index.html"
    assert os.path.exists("frontend/style.css"), "Missing frontend/style.css"
    assert os.path.exists("frontend/app.js"), "Missing frontend/app.js"
    assert os.path.exists("frontend/data/india_states_official.geojson"), "Missing official states GeoJSON"
    assert os.path.exists("frontend/data/india_districts_official.geojson"), "Missing official districts GeoJSON"
    
    with open("frontend/index.html") as f:
        html = f.read()
        assert "sim-form" in html, "Missing sim-form in index.html"
        assert "geospatial-map" in html, "Missing geospatial-map container in index.html"
        assert "district-drawer" in html, "Missing district-drawer in index.html"
        
    with open("frontend/app.js") as f:
        js = f.read()
        assert "handleStateClick" in js, "Missing handleStateClick in app.js"
        assert "handleDistrictClick" in js, "Missing handleDistrictClick in app.js"
        assert "runSimulation" in js, "Missing runSimulation in app.js"
        
    print("  -> PASSED: Frontend HTML, CSS, JS and official Survey of India GeoJSON assets verified.")

if __name__ == "__main__":
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
