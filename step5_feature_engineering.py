# ==============================================================================
# STEP 5: FEATURE ENGINEERING SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Dataset: data/processed/krishijal_master_dataset.csv
# Tasks: Verify encoding, feature matrix preparation, and scaling.
# ==============================================================================

import pandas as pd
from sklearn.preprocessing import StandardScaler

print("=" * 70)
print("STEP 5: FEATURE ENGINEERING ON KRISHIJAL MASTER DATASET")
print("=" * 70)

# Load master dataset
data_file = "data/processed/krishijal_master_dataset.csv"
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)
print(f"Loaded {len(df)} records across {df['district'].nunique()} districts in {df['state'].nunique()} States & UTs.")

# Step 5.1: 14 Selected Feature Columns
feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

print(f"Selected {len(feature_cols)} agronomic and meteorological features:")
for idx, col in enumerate(feature_cols, 1):
    print(f"  {idx:2d}. {col}")

# Step 5.2: Verification of Scaling
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[feature_cols])

print("\n" + "=" * 70)
print("STEP 5 COMPLETE: FEATURE MATRIX PREPARED SUCCESSFULLY")
print(f"Matrix Shape: {X_scaled.shape} (Records: {X_scaled.shape[0]}, Features: {X_scaled.shape[1]})")
print(f"Mean of scaled features: {X_scaled.mean():.4f} (centered at 0)")
print(f"Std of scaled features:  {X_scaled.std():.4f} (unit variance)")
print("=" * 70)
