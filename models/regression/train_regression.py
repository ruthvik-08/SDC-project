"""
KrishiJal: Regression Model Training Pipeline
Loads data from data/processed/krishijal_master_dataset.csv
Trains regression models:
  1. Linear Regression
  2. Polynomial Regression (Degree 2)
Predicts two physical agro-hydrological targets:
  Target A: irrigation_priority_index (0 - 100)
  Target B: water_deficit (mm/day)
Enforces correct ML practices:
  - 80/20 Train-Test split
  - StandardScaler fit exclusively on X_train (Zero Data Leakage)
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

MASTER_CSV = "data/processed/krishijal_master_dataset.csv"

REGRESSION_FEATURES = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

def train_and_evaluate_regression(dataset_path=MASTER_CSV):
    print("=" * 70)
    print("KRISHIJAL: REGRESSION MODELS TRAINING")
    print(f"Dataset: {dataset_path}")
    print("=" * 70)
    
    df = pd.read_csv(dataset_path)
    X = df[REGRESSION_FEATURES].copy()
    y_priority = df["irrigation_priority_index"].copy()
    y_deficit = df["water_deficit"].copy()
    
    # 80/20 Train-Test Split
    X_train, X_test, y_train_pri, y_test_pri, y_train_def, y_test_def = train_test_split(
        X, y_priority, y_deficit, test_size=0.20, random_state=42
    )
    
    # Feature Scaling - Strictly on X_train
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    results = {
        "irrigation_priority": {},
        "water_deficit": {}
    }
    trained_models = {}
    
    # 1. Target A: Irrigation Priority Index
    print("\n--- Target A: Irrigation Priority Index (0 - 100) ---")
    reg_models_pri = {
        "Linear Regression": LinearRegression(),
        "Polynomial Regression (Deg 2)": Pipeline([
            ("poly", PolynomialFeatures(degree=2)),
            ("linear", LinearRegression())
        ])
    }
    
    for name, model in reg_models_pri.items():
        model.fit(X_train_scaled, y_train_pri)
        preds = model.predict(X_test_scaled)
        
        mae = float(mean_absolute_error(y_test_pri, preds))
        mse = float(mean_squared_error(y_test_pri, preds))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test_pri, preds))
        
        results["irrigation_priority"][name] = {
            "mae": round(mae, 4),
            "mse": round(mse, 4),
            "rmse": round(rmse, 4),
            "r2_score": round(r2, 4)
        }
        trained_models[f"priority_{name}"] = model
        print(f"  [{name:30s}] MAE: {mae:6.2f} | RMSE: {rmse:6.2f} | R2: {r2:.4f}")
        
    # 2. Target B: Water Deficit (mm/day)
    print("\n--- Target B: Water Deficit (mm/day) ---")
    reg_models_def = {
        "Linear Regression": LinearRegression(),
        "Polynomial Regression (Deg 2)": Pipeline([
            ("poly", PolynomialFeatures(degree=2)),
            ("linear", LinearRegression())
        ])
    }
    
    for name, model in reg_models_def.items():
        model.fit(X_train_scaled, y_train_def)
        preds = model.predict(X_test_scaled)
        
        mae = float(mean_absolute_error(y_test_def, preds))
        mse = float(mean_squared_error(y_test_def, preds))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test_def, preds))
        
        results["water_deficit"][name] = {
            "mae": round(mae, 4),
            "mse": round(mse, 4),
            "rmse": round(rmse, 4),
            "r2_score": round(r2, 4)
        }
        trained_models[f"deficit_{name}"] = model
        print(f"  [{name:30s}] MAE: {mae:6.2f} | RMSE: {rmse:6.2f} | R2: {r2:.4f}")
        
    return results, trained_models, scaler

if __name__ == "__main__":
    metrics, _, _ = train_and_evaluate_regression()
