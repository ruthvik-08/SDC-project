"""
Stage 5: Feature Engineering Script
Author: First-Year B.Tech Student Project
Purpose: Select, transform, encode, and scale features for:
         1. Crop Stress Classification
         2. Water Deficit / Irrigation Regression
         3. Agricultural Region Clustering & PCA
"""

import joblib
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder

# Paths
DATA_PATH = "data/processed/all_india_agricultural_processed.csv"
MODEL_DIR = "backend/models"

print("=" * 70)
print("STAGE 5: FEATURE ENGINEERING")
print("=" * 70)

# Load processed data
df = pd.read_csv(DATA_PATH)
print(f"Loaded processed dataset with {df.shape[0]} rows and {df.shape[1]} columns.")

# Step 1: Feature Selection
# Selected core features based on actual dataset availability and physical relevance:
# 1. Temperature (°C)
# 2. Maximum Temperature (°C)
# 3. Minimum Temperature (°C)
# 4. Rainfall (mm/day)
# 5. Humidity (%)
# 6. Effective Soil Wetness (0 to 1)
# 7. Solar Radiation (MJ/m2/day)
# 8. Soil pH
# 9. Soil Organic Carbon (%)
# 10. NDVI (Vegetation Canopy Index)
# 11. Reference Evapotranspiration ET0 (mm/day)
# 12. Potential Evapotranspiration ETc (mm/day)
# 13. Crop Type (Categorical)
# 14. Growth Stage (Categorical)

numeric_features = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph",
    "soil_organic_carbon", "ndvi", "et0", "etc"
]

categorical_features = ["crop_type", "growth_stage"]

print("\nSelected Features:")
print(" - Numerical features:", numeric_features)
print(" - Categorical features:", categorical_features)

# Step 2: Encode Categorical Features using LabelEncoder (beginner-friendly & compact)
crop_encoder = LabelEncoder()
df["crop_type_encoded"] = crop_encoder.fit_transform(df["crop_type"])

stage_encoder = LabelEncoder()
df["growth_stage_encoded"] = stage_encoder.fit_transform(df["growth_stage"])

# Save encoders for backend inference
joblib.dump(crop_encoder, MODEL_DIR + "/crop_encoder.joblib")
joblib.dump(stage_encoder, MODEL_DIR + "/stage_encoder.joblib")
print("Saved crop_encoder and stage_encoder to backend/models/")

# Step 3: Combine feature columns
all_model_features = numeric_features + ["crop_type_encoded", "growth_stage_encoded"]

X = df[all_model_features].copy()
y_class = df["stress_level_code"].copy()          # 0=Low, 1=Moderate, 2=High, 3=Severe
y_reg = df["water_deficit"].copy()               # Continuous daily water deficit (mm/day)
y_priority = df["irrigation_priority_index"].copy() # Continuous 0 to 100

print(f"Feature matrix X shape: {X.shape}")
print(f"Target classification y_class shape: {y_class.shape}")
print(f"Target regression y_reg shape: {y_reg.shape}")

# Step 4: Fit StandardScaler
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
joblib.dump(scaler, MODEL_DIR + "/feature_scaler.joblib")
joblib.dump(all_model_features, MODEL_DIR + "/model_features.joblib")
print("Saved feature_scaler and feature list to backend/models/")

# Step 5: Save engineered feature dataset for model training
engineered_df = df.copy()
engineered_df["crop_type_encoded"] = df["crop_type_encoded"]
engineered_df["growth_stage_encoded"] = df["growth_stage_encoded"]
engineered_path = "data/processed/agricultural_engineered_features.csv"
engineered_df.to_csv(engineered_path, index=False)
print(f"Engineered feature dataset saved to: {engineered_path}")

print("\n" + "=" * 70)
print("STAGE 5 SUMMARY: FEATURE ENGINEERING COMPLETED")
print(f"Total features ready for models: {len(all_model_features)}")
print(f"All encoders and scaler stored in: {MODEL_DIR}")
print("=" * 70)
