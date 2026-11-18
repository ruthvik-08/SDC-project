"""
Stage 14: Comprehensive Automated Test Suite
Author: First-Year B.Tech Student Project
Tests:
 1. Dataset loading (raw and processed)
 2. Data preprocessing & physical bounds (CWSI, NDVI, IPI)
 3. Machine learning models and Joblib artifacts
 4. Model predictions (Classification, Regression, Clustering, PCA)
 5. FastAPI backend endpoints
 6. Error handling, invalid inputs, and edge cases
 7. Irrigation priority sorting and ranking logic
 8. Frontend static files integrity
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import FastAPI app from backend
from backend.main import app, feature_cols, scaler, model_rf, model_dt, model_knn, model_poly_deficit, model_poly_ipi

# Initialize TestClient
client = TestClient(app)

print("=" * 80)
print("STAGE 14: AUTOMATED TESTING SUITE")
print("=" * 80)

def test_1_dataset_loading():
    print("\n[Test 1] Testing Dataset Loading...")
    raw_path = "data/raw/all_india_agricultural_raw.csv"
    processed_path = "data/processed/all_india_agricultural_processed.csv"
    
    assert os.path.exists(raw_path), f"Raw dataset not found at {raw_path}"
    assert os.path.exists(processed_path), f"Processed dataset not found at {processed_path}"
    
    df_raw = pd.read_csv(raw_path)
    df_proc = pd.read_csv(processed_path)
    
    assert len(df_raw) == 4758, f"Expected 4758 raw rows, got {len(df_raw)}"
    assert len(df_proc) == 4758, f"Expected 4758 processed rows, got {len(df_proc)}"
    assert df_proc["district"].nunique() == 26, f"Expected 26 districts, got {df_proc['district'].nunique()}"
    assert df_proc["zone"].nunique() >= 6, f"Expected at least 6 zones, got {df_proc['zone'].nunique()}"
    
    print(f"  -> PASSED: Successfully loaded datasets with {len(df_proc)} records across {df_proc['district'].nunique()} districts.")

def test_2_data_preprocessing_and_bounds():
    print("\n[Test 2] Testing Data Preprocessing & Agronomic Bounds...")
    df = pd.read_csv("data/processed/all_india_agricultural_processed.csv")
    
    # 0 null values
    null_count = df.isnull().sum().sum()
    assert null_count == 0, f"Found {null_count} null values in processed dataset!"
    
    # Physical bounds checks
    assert (df["cwsi"] >= 0.0).all() and (df["cwsi"] <= 1.0).all(), "CWSI out of [0, 1] bounds!"
    assert (df["ndvi"] >= 0.10).all() and (df["ndvi"] <= 1.0).all(), "NDVI out of valid vegetation bounds!"
    assert (df["irrigation_priority_index"] >= 0.0).all() and (df["irrigation_priority_index"] <= 100.0).all(), "IPI out of [0, 100] bounds!"
    assert (df["effective_soil_wetness"] >= 0.0).all() and (df["effective_soil_wetness"] <= 1.0).all(), "Soil moisture out of bounds!"
    assert (df["water_deficit"] >= 0.0).all(), "Water deficit cannot be negative!"
    
    # Check categorical labels
    valid_stress = {"Low", "Moderate", "High", "Severe"}
    assert set(df["stress_level"].unique()).issubset(valid_stress), "Invalid stress level categories found!"
    
    print("  -> PASSED: All agronomic bounds (CWSI, NDVI, IPI, Soil Wetness) verified perfectly with 0 nulls.")

def test_3_models_and_artifacts():
    print("\n[Test 3] Testing Saved Models & Artifacts in backend/models/...")
    expected_files = [
        "best_crop_stress_random_forest.joblib",
        "best_crop_stress_decision_tree.joblib",
        "best_crop_stress_knn.joblib",
        "logistic_regression.joblib",
        "naive_bayes.joblib",
        "linear_regression_water_deficit.joblib",
        "polynomial_regression_water_deficit.joblib",
        "linear_regression_irrigation_priority.joblib",
        "polynomial_regression_irrigation_priority.joblib",
        "kmeans_cluster.joblib",
        "pca_model.joblib",
        "crop_encoder.joblib",
        "stage_encoder.joblib",
        "feature_scaler.joblib",
        "model_features.joblib",
        "model_metrics.json"
    ]
    
    for filename in expected_files:
        path = os.path.join("backend/models", filename)
        assert os.path.exists(path), f"Missing artifact: {path}"
        assert os.path.getsize(path) > 0, f"Empty artifact file: {path}"
        
    print(f"  -> PASSED: All {len(expected_files)} required model and transformer artifacts verified.")

def test_4_model_predictions():
    print("\n[Test 4] Testing Model Inferences...")
    # Create sample synthetic input row
    sample_raw = [32.0, 38.0, 24.0, 0.0, 45.0, 0.35, 21.0, 7.8, 0.45, 0.65, 5.2, 5.8, 0, 1]
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
    pred_def = float(model_poly_deficit.predict(scaled_x)[0])
    raw_ipi = float(model_poly_ipi.predict(scaled_x)[0])
    clipped_ipi = float(np.clip(raw_ipi, 0.0, 100.0))
    
    assert isinstance(pred_def, float) and not np.isnan(pred_def), "Deficit must be a valid float"
    assert isinstance(raw_ipi, float) and not np.isnan(raw_ipi), "IPI must be a valid float"
    assert 0.0 <= clipped_ipi <= 100.0, f"Clipped IPI regression out of bounds: {clipped_ipi}"
    
    print(f"  -> PASSED: Inferences executed. RF Class={pred_rf}, DT Class={pred_dt}, Deficit={pred_def:.2f}mm, Raw IPI={raw_ipi:.1f}, Clipped IPI={clipped_ipi:.1f}")

def test_5_api_endpoints():
    print("\n[Test 5] Testing FastAPI Endpoints...")
    
    # Root
    r0 = client.get("/")
    assert r0.status_code == 200, f"Root returned {r0.status_code}"
    assert r0.json()["status"] == "Online and Operational"
    
    # Dataset Info
    r1 = client.get("/api/dataset/info")
    assert r1.status_code == 200
    assert r1.json()["total_records"] == 4758
    assert len(r1.json()["districts_list"]) == 26
    
    # Districts
    r2 = client.get("/api/districts")
    assert r2.status_code == 200
    assert len(r2.json()["districts"]) == 26
    
    # Clusters
    r3 = client.get("/api/clusters/regions")
    assert r3.status_code == 200
    assert len(r3.json()["districts_clustered"]) == 26
    
    # Irrigation Priority
    r4 = client.get("/api/irrigation/priority")
    assert r4.status_code == 200
    assert len(r4.json()["ranked_districts"]) == 26
    
    # Model Evaluation
    r5 = client.get("/api/models/evaluation")
    assert r5.status_code == 200
    assert "classification" in r5.json()
    assert "regression_water_deficit" in r5.json()
    
    # Live Prediction POST
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
    res = r6.json()
    assert res["crop_stress_level"] in ["High", "Severe"], f"Expected High or Severe stress for arid drought inputs, got {res['crop_stress_level']}"
    assert res["irrigation_priority_index"] > 50.0, f"Expected high priority for arid drought inputs, got {res['irrigation_priority_index']}"
    assert "recommendation" in res
    
    print("  -> PASSED: All 6 core REST API endpoints returned 200 OK with correct payloads.")

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
        "crop_type": "ExoticDragonFruit",  # Unseen crop
        "growth_stage": "UnknownStage",     # Unseen stage
        "selected_model": "Random Forest"
    }
    r_edge = client.post("/api/predict/crop-stress", json=edge_payload)
    assert r_edge.status_code == 200, "API should safely handle unknown crop with fallback encoding"
    
    # Edge case 2: Invalid data type payload (e.g. string for temperature)
    invalid_payload = {
        "temperature": "hot_day",
        "crop_type": "Rice"
    }
    r_inv = client.post("/api/predict/crop-stress", json=invalid_payload)
    assert r_inv.status_code == 422, "API should return HTTP 422 Unprocessable Entity for invalid types"
    
    print("  -> PASSED: Robust error handling verified for unseen categories, fallbacks, and 422 schema validation.")

def test_7_irrigation_priority_logic():
    print("\n[Test 7] Testing Irrigation Priority Ranking Logic...")
    r = client.get("/api/irrigation/priority")
    districts = r.json()["ranked_districts"]
    
    # Check that districts are sorted descending by Irrigation Priority Index
    scores = [d["irrigation_priority_index"] for d in districts]
    assert scores == sorted(scores, reverse=True), "Districts are not properly sorted descending by priority!"
    
    # Check that ranks are 1 to 26
    ranks = [d["rank"] for d in districts]
    assert ranks == list(range(1, 27)), "Ranks must be 1 to 26"
    
    print("  -> PASSED: Irrigation priority table verified (strict descending order from Rank #1 to #26).")

def test_8_frontend_integrity():
    print("\n[Test 8] Testing Frontend Files Integrity...")
    assert os.path.exists("frontend/index.html"), "Missing frontend/index.html"
    assert os.path.exists("frontend/style.css"), "Missing frontend/style.css"
    assert os.path.exists("frontend/app.js"), "Missing frontend/app.js"
    
    with open("frontend/index.html") as f:
        html = f.read()
        assert "prediction-form" in html, "Missing prediction form in index.html"
        assert "priority-table" in html, "Missing priority table in index.html"
        assert "chart-stress" in html, "Missing chart-stress canvas in index.html"
        
    with open("frontend/app.js") as f:
        js = f.read()
        assert "handlePrediction" in js, "Missing handlePrediction in app.js"
        assert "fetchIrrigationPriority" in js, "Missing fetchIrrigationPriority in app.js"
        
    print("  -> PASSED: Frontend HTML, CSS, and JS components verified.")

if __name__ == "__main__":
    test_1_dataset_loading()
    test_2_data_preprocessing_and_bounds()
    test_3_models_and_artifacts()
    test_4_model_predictions()
    test_5_api_endpoints()
    test_6_invalid_inputs_and_edge_cases()
    test_7_irrigation_priority_logic()
    test_8_frontend_integrity()
    
    print("\n" + "=" * 80)
    print("ALL 8 STAGES OF TEST SUITE PASSED SUCCESSFULLY! (100% PASS RATE)")
    print("=" * 80)
